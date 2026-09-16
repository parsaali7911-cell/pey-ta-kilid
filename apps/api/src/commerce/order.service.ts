import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  QuoteStatus,
  RfqStatus,
} from '@prisma/client';
import {
  canTransitionQuoteStatus,
  canTransitionRfqStatus,
  PaymentTermsCode,
  QuoteStatus as SharedQuoteStatus,
  RfqStatus as SharedRfqStatus,
  SubmitPaymentInput,
} from '@peytakilid/shared-types';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';
import { OrgAccessService } from '../common/org-access.service';
import { InventoryService } from '../inventory/inventory.service';
import { ErpOutboxService } from '../erp/erp-outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  toBuyerOrder,
  toBuyerPayment,
  toSellerOrder,
} from './order.mapper';

const ORDER_INCLUDE = {
  buyerOrganization: { select: { id: true, name: true, slug: true } },
  sellerOrganization: { select: { id: true, name: true, slug: true } },
  items: { orderBy: { sortOrder: 'asc' as const } },
  payments: { orderBy: { submittedAt: 'desc' as const }, take: 10 },
} satisfies Prisma.OrderInclude;

const QUOTE_ACCEPT_INCLUDE = {
  sellerOrganization: { select: { id: true, name: true, slug: true } },
  rfq: { select: { id: true, buyerOrganizationId: true, status: true } },
  items: { orderBy: { sortOrder: 'asc' as const } },
  order: true,
} satisfies Prisma.QuoteInclude;

type PaymentSplit = { seq: number; pct: number; days: number };

function paymentSplits(code: string): PaymentSplit[] {
  if (code === PaymentTermsCode.SPLIT_50_50) {
    return [
      { seq: 1, pct: 50, days: 0 },
      { seq: 2, pct: 50, days: 14 },
    ];
  }
  if (code === PaymentTermsCode.SPLIT_30_40_30) {
    return [
      { seq: 1, pct: 30, days: 0 },
      { seq: 2, pct: 40, days: 14 },
      { seq: 3, pct: 30, days: 30 },
    ];
  }
  return [{ seq: 1, pct: 100, days: 0 }];
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly erpOutbox: ErpOutboxService,
  ) {}

  /**
   * Accept SUBMITTED quote → create Order + reserve inventory.
   * Idempotent: re-accept / re-call returns the existing order for the quote.
   */
  async acceptQuoteAndCreateOrder(userId: string, quoteId: string) {
    let quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: QUOTE_ACCEPT_INCLUDE,
    });
    if (!quote) throw new NotFoundException('Quote not found');

    await this.orgAccess.requireBuyerWriter(userId, quote.rfq.buyerOrganizationId);

    quote = await this.expireIfPastValidity(quote);

    if (quote.status === QuoteStatus.ACCEPTED && quote.order) {
      return toBuyerOrder(await this.getRaw(quote.order.id));
    }

    if (quote.status === QuoteStatus.ACCEPTED && !quote.order) {
      return this.createOrderFromAcceptedQuote(userId, quoteId);
    }

    if (
      !canTransitionQuoteStatus(
        quote.status as SharedQuoteStatus,
        SharedQuoteStatus.ACCEPTED,
      )
    ) {
      throw new BadRequestException(`Cannot accept quote from status ${quote.status}`);
    }

    const listingIds = quote.items
      .map((i) => i.listingId)
      .filter((id): id is string => Boolean(id));
    const listings = listingIds.length
      ? await this.prisma.listing.findMany({
          where: { id: { in: listingIds } },
          select: { id: true, facilityId: true, uomCode: true, organizationId: true },
        })
      : [];
    const listingMap = new Map(listings.map((l) => [l.id, l]));

    const termsCode = PaymentTermsCode.ADVANCE_100;
    const now = new Date();

    const orderId = await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.ACCEPTED },
      });

      await tx.quote.updateMany({
        where: {
          rfqId: quote.rfqId,
          id: { not: quoteId },
          status: QuoteStatus.SUBMITTED,
        },
        data: { status: QuoteStatus.CANCELLED },
      });

      const rfq = await tx.rfq.findUnique({ where: { id: quote.rfqId } });
      if (
        rfq &&
        canTransitionRfqStatus(rfq.status as SharedRfqStatus, SharedRfqStatus.ACCEPTED)
      ) {
        await tx.rfq.update({
          where: { id: quote.rfqId },
          data: { status: RfqStatus.ACCEPTED },
        });
      }

      // Idempotent create — unique quoteId
      const existing = await tx.order.findUnique({ where: { quoteId } });
      if (existing) return existing.id;

      const order = await tx.order.create({
        data: {
          quoteId,
          rfqId: quote.rfqId,
          buyerOrganizationId: quote.rfq.buyerOrganizationId,
          sellerOrganizationId: quote.sellerOrganizationId,
          createdByUserId: userId,
          status: OrderStatus.AWAITING_PAYMENT,
          currency: quote.currency,
          priceType: quote.priceType,
          totalDisplayPrice: quote.totalDisplayPrice ?? 0,
          totalBasePrice: quote.totalBasePrice ?? 0,
          paymentTermsCode: termsCode,
          confirmedAt: now,
          items: {
            create: quote.items.map((item, idx) => {
              const qty = Number(item.quantity);
              const displayPrice = Number(item.displayPrice);
              const basePrice = Number(item.basePrice);
              const listing = item.listingId ? listingMap.get(item.listingId) : undefined;
              return {
                quoteItemId: item.id,
                listingId: item.listingId,
                productId: item.productId,
                variantId: item.variantId,
                facilityId: listing?.facilityId ?? null,
                quantity: item.quantity,
                uomCode: item.uomCode,
                basePrice: item.basePrice,
                displayPrice: item.displayPrice,
                currency: item.currency,
                priceType: item.priceType,
                fxRateApplied: item.fxRateApplied,
                marginPercentApplied: item.marginPercentApplied,
                flatFeeApplied: item.flatFeeApplied,
                leadTimeDays: item.leadTimeDays,
                titleSnapshot: item.titleSnapshot,
                lineDisplayTotal: displayPrice * qty,
                lineBaseTotal: basePrice * qty,
                sortOrder: idx,
              };
            }),
          },
        },
        include: { items: true },
      });

      const splits = paymentSplits(termsCode);
      const total = Number(order.totalDisplayPrice);
      await tx.orderPaymentSchedule.create({
        data: {
          orderId: order.id,
          termsCode,
          totalAmount: total,
          currency: order.currency,
          installments: {
            create: splits.map((s) => ({
              sequence: s.seq,
              label: `Installment ${s.seq}`,
              percent: s.pct,
              amount: (total * s.pct) / 100,
              currency: order.currency,
              dueDate: new Date(now.getTime() + s.days * 86400000),
              status: PaymentStatus.PENDING,
            })),
          },
        },
      });

      for (const item of order.items) {
        if (!item.listingId) continue;
        const listing = listingMap.get(item.listingId);
        if (listing && listing.organizationId !== quote.sellerOrganizationId) {
          throw new ForbiddenException('Listing does not belong to seller');
        }
        await this.inventory.reserveInTx(tx, {
          listingId: item.listingId,
          quantity: Number(item.quantity),
          uomCode: item.uomCode,
          actorUserId: userId,
          orderId: order.id,
          orderItemId: item.id,
        });
      }

      return order.id;
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: quote.rfq.buyerOrganizationId,
      entityType: 'Quote',
      entityId: quoteId,
      action: 'QUOTE_ACCEPTED',
      metadata: {
        rfqId: quote.rfqId,
        sellerOrganizationId: quote.sellerOrganizationId,
        orderId,
      },
    });
    await this.audit.record({
      actorUserId: userId,
      organizationId: quote.rfq.buyerOrganizationId,
      entityType: 'Order',
      entityId: orderId,
      action: 'ORDER_CREATED',
      metadata: { quoteId, rfqId: quote.rfqId },
    });
    await this.notifications.enqueue({
      organizationId: quote.rfq.buyerOrganizationId,
      type: 'ORDER_CREATED',
      title: 'Order created',
      payload: { orderId, quoteId, rfqId: quote.rfqId },
    });
    await this.notifications.enqueue({
      organizationId: quote.sellerOrganizationId,
      type: 'ORDER_CREATED',
      title: 'Order created',
      payload: { orderId, quoteId, rfqId: quote.rfqId },
    });

    await this.erpOutbox.enqueueSafe({
      jobType: 'SYNC_ORDER',
      entityType: 'Order',
      entityId: orderId,
      idempotencyKey: `order:${orderId}`,
      payload: { quoteId, rfqId: quote.rfqId },
    });

    return toBuyerOrder(await this.getRaw(orderId));
  }

  /** Recovery path: ACCEPTED quote without order. */
  async createOrderFromAcceptedQuote(userId: string, quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: QUOTE_ACCEPT_INCLUDE,
    });
    if (!quote) throw new NotFoundException('Quote not found');
    await this.orgAccess.requireBuyerWriter(userId, quote.rfq.buyerOrganizationId);
    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException('Quote must be ACCEPTED');
    }
    if (quote.order) return toBuyerOrder(await this.getRaw(quote.order.id));

    // Re-enter accept flow with already-accepted status handled above only when order missing —
    // create order + reserve in a dedicated transaction.
    const listingIds = quote.items
      .map((i) => i.listingId)
      .filter((id): id is string => Boolean(id));
    const listings = listingIds.length
      ? await this.prisma.listing.findMany({
          where: { id: { in: listingIds } },
          select: { id: true, facilityId: true, uomCode: true, organizationId: true },
        })
      : [];
    const listingMap = new Map(listings.map((l) => [l.id, l]));
    const termsCode = PaymentTermsCode.ADVANCE_100;
    const now = new Date();

    const orderId = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { quoteId } });
      if (existing) return existing.id;

      const order = await tx.order.create({
        data: {
          quoteId,
          rfqId: quote.rfqId,
          buyerOrganizationId: quote.rfq.buyerOrganizationId,
          sellerOrganizationId: quote.sellerOrganizationId,
          createdByUserId: userId,
          status: OrderStatus.AWAITING_PAYMENT,
          currency: quote.currency,
          priceType: quote.priceType,
          totalDisplayPrice: quote.totalDisplayPrice ?? 0,
          totalBasePrice: quote.totalBasePrice ?? 0,
          paymentTermsCode: termsCode,
          confirmedAt: now,
          items: {
            create: quote.items.map((item, idx) => {
              const qty = Number(item.quantity);
              const displayPrice = Number(item.displayPrice);
              const basePrice = Number(item.basePrice);
              const listing = item.listingId ? listingMap.get(item.listingId) : undefined;
              return {
                quoteItemId: item.id,
                listingId: item.listingId,
                productId: item.productId,
                variantId: item.variantId,
                facilityId: listing?.facilityId ?? null,
                quantity: item.quantity,
                uomCode: item.uomCode,
                basePrice: item.basePrice,
                displayPrice: item.displayPrice,
                currency: item.currency,
                priceType: item.priceType,
                fxRateApplied: item.fxRateApplied,
                marginPercentApplied: item.marginPercentApplied,
                flatFeeApplied: item.flatFeeApplied,
                leadTimeDays: item.leadTimeDays,
                titleSnapshot: item.titleSnapshot,
                lineDisplayTotal: displayPrice * qty,
                lineBaseTotal: basePrice * qty,
                sortOrder: idx,
              };
            }),
          },
        },
        include: { items: true },
      });

      const total = Number(order.totalDisplayPrice);
      await tx.orderPaymentSchedule.create({
        data: {
          orderId: order.id,
          termsCode,
          totalAmount: total,
          currency: order.currency,
          installments: {
            create: paymentSplits(termsCode).map((s) => ({
              sequence: s.seq,
              label: `Installment ${s.seq}`,
              percent: s.pct,
              amount: (total * s.pct) / 100,
              currency: order.currency,
              dueDate: new Date(now.getTime() + s.days * 86400000),
              status: PaymentStatus.PENDING,
            })),
          },
        },
      });

      for (const item of order.items) {
        if (!item.listingId) continue;
        await this.inventory.reserveInTx(tx, {
          listingId: item.listingId,
          quantity: Number(item.quantity),
          uomCode: item.uomCode,
          actorUserId: userId,
          orderId: order.id,
          orderItemId: item.id,
        });
      }

      return order.id;
    });

    await this.erpOutbox.enqueueSafe({
      jobType: 'SYNC_ORDER',
      entityType: 'Order',
      entityId: orderId,
      idempotencyKey: `order:${orderId}`,
    });

    return toBuyerOrder(await this.getRaw(orderId));
  }

  async getBuyerOrder(userId: string, orderId: string) {
    const order = await this.getRaw(orderId);
    await this.orgAccess.requireBuyerMember(userId, order.buyerOrganizationId);
    return toBuyerOrder(order);
  }

  async getSellerOrder(userId: string, orderId: string) {
    const order = await this.getRaw(orderId);
    await this.orgAccess.requireSellerMember(userId, order.sellerOrganizationId);
    return toSellerOrder(order);
  }

  async listBuyerOrders(userId: string, buyerOrganizationId: string) {
    await this.orgAccess.requireBuyerMember(userId, buyerOrganizationId);
    const rows = await this.prisma.order.findMany({
      where: { buyerOrganizationId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toBuyerOrder);
  }

  async listSubmittedPayments() {
    const rows = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.SUBMITTED },
      include: {
        order: {
          select: {
            id: true,
            publicId: true,
            status: true,
            totalDisplayPrice: true,
            currency: true,
            buyerOrganization: { select: { id: true, name: true, slug: true } },
            sellerOrganization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    });
    return rows.map((p) => ({
      ...toBuyerPayment(p),
      order: {
        id: p.order.id,
        publicId: p.order.publicId,
        status: p.order.status,
        totalDisplayPrice: Number(p.order.totalDisplayPrice),
        currency: p.order.currency,
        buyer: p.order.buyerOrganization,
        seller: p.order.sellerOrganization,
      },
    }));
  }

  async listSellerOrders(userId: string, sellerOrganizationId: string) {
    await this.orgAccess.requireSellerMember(userId, sellerOrganizationId);
    const rows = await this.prisma.order.findMany({
      where: { sellerOrganizationId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSellerOrder);
  }

  async submitPayment(userId: string, input: SubmitPaymentInput) {
    const order = await this.getRaw(input.orderId);
    await this.orgAccess.requireBuyerWriter(userId, order.buyerOrganizationId);

    if (input.amount <= 0) throw new BadRequestException('amount must be > 0');
    if (!Object.values(PaymentMethod).includes(input.method as PaymentMethod)) {
      throw new BadRequestException(`Unsupported payment method: ${input.method}`);
    }
    if (!input.idempotencyKey?.trim()) {
      throw new BadRequestException('idempotencyKey required');
    }

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.orderId !== order.id) {
        throw new BadRequestException('idempotencyKey already used');
      }
      return toBuyerPayment(existing);
    }

    // Avoid duplicate open submissions for the same order+amount (UI double-click / refresh).
    const open = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        amount: input.amount,
        status: { in: [PaymentStatus.SUBMITTED, PaymentStatus.PENDING] },
      },
      orderBy: { submittedAt: 'desc' },
    });
    if (open) return toBuyerPayment(open);

    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(`Cannot submit payment for order status ${order.status}`);
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        idempotencyKey: input.idempotencyKey,
        method: input.method as PaymentMethod,
        status: PaymentStatus.SUBMITTED,
        amount: input.amount,
        currency: order.currency,
        reference: input.reference ?? null,
        submittedAt: new Date(),
      },
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: order.buyerOrganizationId,
      entityType: 'Payment',
      entityId: payment.id,
      action: 'PAYMENT_SUBMITTED',
      metadata: { orderId: order.id, amount: input.amount },
    });
    await this.notifications.enqueue({
      organizationId: order.buyerOrganizationId,
      type: 'PAYMENT_SUBMITTED',
      title: 'Payment submitted',
      payload: { paymentId: payment.id, orderId: order.id },
    });

    return toBuyerPayment(payment);
  }

  async confirmPayment(adminUserId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.CONFIRMED) {
      return toBuyerPayment(payment);
    }
    if (payment.status !== PaymentStatus.SUBMITTED) {
      throw new BadRequestException(`Cannot confirm payment from status ${payment.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.CONFIRMED,
          confirmedAt: new Date(),
          verifiedByUserId: adminUserId,
        },
      });

      const confirmedSum = await tx.payment.aggregate({
        where: { orderId: payment.orderId, status: PaymentStatus.CONFIRMED },
        _sum: { amount: true },
      });
      const paid = Number(confirmedSum._sum.amount ?? 0);
      const total = Number(payment.order.totalDisplayPrice);
      const nextStatus =
        paid >= total ? OrderStatus.PAID : OrderStatus.PARTIALLY_PAID;

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: nextStatus },
      });

      return confirmed;
    });

    await this.audit.record({
      actorUserId: adminUserId,
      organizationId: payment.order.buyerOrganizationId,
      entityType: 'Payment',
      entityId: paymentId,
      action: 'PAYMENT_CONFIRMED',
      metadata: { orderId: payment.orderId },
    });

    await this.erpOutbox.enqueueSafe({
      jobType: 'SYNC_PAYMENT',
      entityType: 'Payment',
      entityId: paymentId,
      idempotencyKey: `payment:${paymentId}`,
      payload: { orderId: payment.orderId },
    });

    return toBuyerPayment(updated);
  }

  private async expireIfPastValidity<
    T extends {
      id: string;
      status: QuoteStatus | string;
      validUntil: Date | null;
      sellerOrganizationId: string;
      rfqId: string;
    },
  >(quote: T): Promise<T> {
    if (
      quote.status === QuoteStatus.SUBMITTED &&
      quote.validUntil &&
      quote.validUntil.getTime() < Date.now()
    ) {
      if (
        canTransitionQuoteStatus(
          quote.status as SharedQuoteStatus,
          SharedQuoteStatus.EXPIRED,
        )
      ) {
        await this.prisma.quote.update({
          where: { id: quote.id },
          data: { status: QuoteStatus.EXPIRED },
        });
        await this.audit.record({
          organizationId: quote.sellerOrganizationId,
          entityType: 'Quote',
          entityId: quote.id,
          action: 'QUOTE_EXPIRED',
          metadata: { rfqId: quote.rfqId },
        });
        return { ...quote, status: QuoteStatus.EXPIRED };
      }
    }
    return quote;
  }

  private async getRaw(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
