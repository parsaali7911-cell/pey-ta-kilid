import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CurrencyCode,
  PriceType,
  Prisma,
  QuoteStatus,
  RfqStatus,
} from '@prisma/client';
import {
  canTransitionQuoteStatus,
  CreateQuoteDraftInput,
  QuoteStatus as SharedQuoteStatus,
  UOM_CODES,
} from '@peytakilid/shared-types';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';
import { OrgAccessService } from '../common/org-access.service';
import { OrderService } from '../commerce/order.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { toBuyerQuote, toSellerQuote } from './quote.mapper';

const QUOTE_INCLUDE = {
  sellerOrganization: { select: { id: true, name: true, slug: true } },
  rfq: { select: { buyerOrganizationId: true, status: true } },
  items: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.QuoteInclude;

const ELIGIBLE_RFQ_STATUSES: RfqStatus[] = [
  RfqStatus.SUBMITTED,
  RfqStatus.RESPONDED,
  RfqStatus.QUOTED,
];

@Injectable()
export class QuoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly orders: OrderService,
  ) {}

  async listEligibleRfqs(userId: string, sellerOrganizationId: string) {
    await this.orgAccess.requireSellerMember(userId, sellerOrganizationId);
    const targets = await this.prisma.rfqTarget.findMany({
      where: {
        sellerOrganizationId,
        rfq: { status: { in: ELIGIBLE_RFQ_STATUSES } },
      },
      include: {
        rfq: {
          select: {
            id: true,
            publicId: true,
            status: true,
            market: true,
            locale: true,
            submittedAt: true,
            createdAt: true,
            buyerOrganization: { select: { id: true, name: true, slug: true } },
            items: {
              where: {
                OR: [
                  { sellerOrganizationId },
                  { listingId: { not: null } },
                ],
              },
              select: {
                id: true,
                listingId: true,
                quantity: true,
                uomCode: true,
                titleSnapshot: true,
                categoryId: true,
              },
            },
          },
        },
        listing: { select: { id: true, publicId: true, slug: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return targets.map((t) => ({
      rfqTargetId: t.id,
      listingId: t.listingId,
      listing: t.listing,
      rfq: {
        id: t.rfq.id,
        publicId: t.rfq.publicId,
        status: t.rfq.status,
        market: t.rfq.market,
        locale: t.rfq.locale,
        submittedAt: t.rfq.submittedAt,
        createdAt: t.rfq.createdAt,
        buyer: t.rfq.buyerOrganization,
        items: t.rfq.items.map((i) => ({
          id: i.id,
          listingId: i.listingId,
          quantity: Number(i.quantity),
          uomCode: i.uomCode,
          titleSnapshot: i.titleSnapshot,
          categoryId: i.categoryId,
        })),
      },
    }));
  }

  async createDraft(userId: string, input: CreateQuoteDraftInput) {
    await this.orgAccess.requireSellerWriter(userId, input.sellerOrganizationId);
    if (!input.items?.length) throw new BadRequestException('Quote requires items');

    const rfq = await this.prisma.rfq.findUnique({
      where: { id: input.rfqId },
      include: {
        targets: true,
        items: true,
      },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (!ELIGIBLE_RFQ_STATUSES.includes(rfq.status)) {
      throw new BadRequestException('RFQ must be SUBMITTED (or open for quotes)');
    }

    const target = this.resolveTarget(rfq.targets, input);
    await this.assertListingOwnership(input, target);

    const currency = input.currency as CurrencyCode;
    const priceType = input.priceType as PriceType;
    if (!Object.values(CurrencyCode).includes(currency)) {
      throw new BadRequestException(`Unsupported currency: ${input.currency}`);
    }
    if (!Object.values(PriceType).includes(priceType)) {
      throw new BadRequestException(`Unsupported priceType: ${input.priceType}`);
    }

    const pricedItems: Array<{
      rfqItemId: string | null;
      listingId: string | null;
      productId: string | null;
      variantId: string | null;
      quantity: number;
      uomCode: string;
      basePrice: number;
      displayPrice: number;
      currency: CurrencyCode;
      priceType: PriceType;
      fxRateApplied: number;
      marginPercentApplied: number;
      flatFeeApplied: number;
      leadTimeDays: number | null;
      titleSnapshot: string | null;
      sortOrder: number;
    }> = [];
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      if (!(UOM_CODES as readonly string[]).includes(item.uomCode)) {
        throw new BadRequestException(`Unsupported uomCode: ${item.uomCode}`);
      }
      if (!(item.quantity > 0) || !(item.basePrice >= 0)) {
        throw new BadRequestException('Invalid quantity or basePrice');
      }
      if (item.rfqItemId) {
        const rfqItem = rfq.items.find((r) => r.id === item.rfqItemId);
        if (!rfqItem) throw new BadRequestException(`Invalid rfqItemId: ${item.rfqItemId}`);
      }

      const priced = await this.pricing.quote({
        supplierCost: item.basePrice,
        currency,
        displayCurrency: currency,
      });

      pricedItems.push({
        rfqItemId: item.rfqItemId ?? null,
        listingId: item.listingId ?? target.listingId ?? null,
        productId: item.productId ?? null,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        uomCode: item.uomCode,
        basePrice: item.basePrice,
        displayPrice: priced.displayPrice,
        currency,
        priceType,
        fxRateApplied: priced.fxRateApplied,
        marginPercentApplied: priced.marginPercentApplied,
        flatFeeApplied: priced.flatFeeApplied,
        leadTimeDays: item.leadTimeDays ?? null,
        titleSnapshot: item.titleSnapshot ?? null,
        sortOrder: i,
      });
    }

    const totalDisplayPrice = pricedItems.reduce(
      (s, it) => s + Number(it.displayPrice) * Number(it.quantity),
      0,
    );
    const totalBasePrice = pricedItems.reduce(
      (s, it) => s + Number(it.basePrice) * Number(it.quantity),
      0,
    );

    const quote = await this.prisma.quote.create({
      data: {
        rfqId: input.rfqId,
        rfqTargetId: target.id,
        sellerOrganizationId: input.sellerOrganizationId,
        createdByUserId: userId,
        status: QuoteStatus.DRAFT,
        currency,
        priceType,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        sellerNotes: input.sellerNotes ?? null,
        totalDisplayPrice,
        totalBasePrice,
        items: { create: pricedItems },
      },
      include: QUOTE_INCLUDE,
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: input.sellerOrganizationId,
      entityType: 'Quote',
      entityId: quote.id,
      action: 'QUOTE_CREATED',
      metadata: { rfqId: input.rfqId, status: QuoteStatus.DRAFT },
    });
    await this.notifications.enqueue({
      userId,
      organizationId: input.sellerOrganizationId,
      type: 'QUOTE_CREATED',
      title: 'Quote created',
      payload: { quoteId: quote.id, rfqId: input.rfqId },
    });

    return toSellerQuote(quote);
  }

  async submit(userId: string, quoteId: string) {
    const quote = await this.getRaw(quoteId);
    await this.orgAccess.requireSellerWriter(userId, quote.sellerOrganizationId);

    if (
      !canTransitionQuoteStatus(
        quote.status as SharedQuoteStatus,
        SharedQuoteStatus.SUBMITTED,
      )
    ) {
      throw new BadRequestException(`Cannot submit quote from status ${quote.status}`);
    }
    if (!quote.items.length) throw new BadRequestException('Quote has no items');

    // Re-snapshot pricing at submit so rule changes after draft don't rewrite history.
    const resnapshoted: Array<{
      id: string;
      displayPrice: number;
      fxRateApplied: number;
      marginPercentApplied: number;
      flatFeeApplied: number;
      quantity: number;
      basePrice: number;
    }> = [];
    for (const item of quote.items) {
      const priced = await this.pricing.quote({
        supplierCost: Number(item.basePrice),
        currency: item.currency,
        displayCurrency: item.currency,
      });
      resnapshoted.push({
        id: item.id,
        displayPrice: priced.displayPrice,
        fxRateApplied: priced.fxRateApplied,
        marginPercentApplied: priced.marginPercentApplied,
        flatFeeApplied: priced.flatFeeApplied,
        quantity: Number(item.quantity),
        basePrice: Number(item.basePrice),
      });
    }

    const totalDisplayPrice = resnapshoted.reduce(
      (s, it) => s + it.displayPrice * it.quantity,
      0,
    );
    const totalBasePrice = resnapshoted.reduce(
      (s, it) => s + it.basePrice * it.quantity,
      0,
    );

    await this.prisma.$transaction(async (tx) => {
      for (const item of resnapshoted) {
        await tx.quoteItem.update({
          where: { id: item.id },
          data: {
            displayPrice: item.displayPrice,
            fxRateApplied: item.fxRateApplied,
            marginPercentApplied: item.marginPercentApplied,
            flatFeeApplied: item.flatFeeApplied,
          },
        });
      }
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.SUBMITTED,
          submittedAt: new Date(),
          totalDisplayPrice,
          totalBasePrice,
        },
      });

      const rfq = await tx.rfq.findUnique({ where: { id: quote.rfqId } });
      if (rfq && (rfq.status === RfqStatus.SUBMITTED || rfq.status === RfqStatus.RESPONDED)) {
        await tx.rfq.update({
          where: { id: quote.rfqId },
          data: { status: RfqStatus.QUOTED },
        });
      }
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: quote.sellerOrganizationId,
      entityType: 'Quote',
      entityId: quoteId,
      action: 'QUOTE_SUBMITTED',
      metadata: { rfqId: quote.rfqId },
    });
    await this.notifications.enqueue({
      userId,
      organizationId: quote.sellerOrganizationId,
      type: 'QUOTE_SUBMITTED',
      title: 'Quote submitted',
      payload: { quoteId, rfqId: quote.rfqId },
    });
    await this.notifications.enqueue({
      organizationId: quote.rfq.buyerOrganizationId,
      type: 'QUOTE_SUBMITTED',
      title: 'Quote received',
      payload: { quoteId, rfqId: quote.rfqId },
    });

    return toSellerQuote(await this.getRaw(quoteId));
  }

  async getSellerQuote(userId: string, quoteId: string) {
    const quote = await this.getRaw(quoteId);
    await this.orgAccess.requireSellerMember(userId, quote.sellerOrganizationId);
    return toSellerQuote(quote);
  }

  async listSellerQuotes(userId: string, sellerOrganizationId: string) {
    await this.orgAccess.requireSellerMember(userId, sellerOrganizationId);
    const rows = await this.prisma.quote.findMany({
      where: { sellerOrganizationId },
      include: QUOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSellerQuote);
  }

  async listBuyerQuotesForRfq(userId: string, rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    await this.orgAccess.requireBuyerMember(userId, rfq.buyerOrganizationId);

    const rows = await this.prisma.quote.findMany({
      where: { rfqId, status: { not: QuoteStatus.DRAFT } },
      include: QUOTE_INCLUDE,
      orderBy: { submittedAt: 'desc' },
    });
    return rows.map(toBuyerQuote);
  }

  async getBuyerQuote(userId: string, quoteId: string) {
    let quote = await this.getRaw(quoteId);
    await this.orgAccess.requireBuyerMember(userId, quote.rfq.buyerOrganizationId);
    if (quote.status === QuoteStatus.DRAFT) {
      throw new ForbiddenException('Quote not available');
    }
    quote = await this.expireIfPastValidity(quote);
    return toBuyerQuote(quote);
  }

  /** Buyer accepts a SUBMITTED quote → creates Order + reserves inventory. */
  async accept(userId: string, quoteId: string) {
    // Return the Order (not the Quote) so buyers can pay immediately from the response.
    return this.orders.acceptQuoteAndCreateOrder(userId, quoteId);
  }

  /** Buyer rejects a SUBMITTED quote. */
  async reject(userId: string, quoteId: string) {
    let quote = await this.getRaw(quoteId);
    await this.orgAccess.requireBuyerWriter(userId, quote.rfq.buyerOrganizationId);
    quote = await this.expireIfPastValidity(quote);

    if (
      !canTransitionQuoteStatus(
        quote.status as SharedQuoteStatus,
        SharedQuoteStatus.REJECTED,
      )
    ) {
      throw new BadRequestException(`Cannot reject quote from status ${quote.status}`);
    }

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.REJECTED },
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: quote.rfq.buyerOrganizationId,
      entityType: 'Quote',
      entityId: quoteId,
      action: 'QUOTE_REJECTED',
      metadata: {
        rfqId: quote.rfqId,
        sellerOrganizationId: quote.sellerOrganizationId,
      },
    });
    await this.notifications.enqueue({
      organizationId: quote.rfq.buyerOrganizationId,
      type: 'QUOTE_REJECTED',
      title: 'Quote rejected',
      payload: { quoteId, rfqId: quote.rfqId },
    });
    await this.notifications.enqueue({
      organizationId: quote.sellerOrganizationId,
      type: 'QUOTE_REJECTED',
      title: 'Quote rejected',
      payload: { quoteId, rfqId: quote.rfqId },
    });

    return toBuyerQuote(await this.getRaw(quoteId));
  }

  /** Seller cancels own DRAFT or SUBMITTED quote. */
  async cancel(userId: string, quoteId: string) {
    const quote = await this.getRaw(quoteId);
    await this.orgAccess.requireSellerWriter(userId, quote.sellerOrganizationId);

    if (
      !canTransitionQuoteStatus(
        quote.status as SharedQuoteStatus,
        SharedQuoteStatus.CANCELLED,
      )
    ) {
      throw new BadRequestException(`Cannot cancel quote from status ${quote.status}`);
    }

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.CANCELLED },
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: quote.sellerOrganizationId,
      entityType: 'Quote',
      entityId: quoteId,
      action: 'QUOTE_CANCELLED',
      metadata: { rfqId: quote.rfqId },
    });
    await this.notifications.enqueue({
      organizationId: quote.sellerOrganizationId,
      type: 'QUOTE_CANCELLED',
      title: 'Quote cancelled',
      payload: { quoteId, rfqId: quote.rfqId },
    });

    return toSellerQuote(await this.getRaw(quoteId));
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

  private resolveTarget(
    targets: Array<{ id: string; sellerOrganizationId: string; listingId: string | null }>,
    input: CreateQuoteDraftInput,
  ) {
    const eligible = targets.filter(
      (t) => t.sellerOrganizationId === input.sellerOrganizationId,
    );
    if (!eligible.length) {
      throw new ForbiddenException('Seller is not targeted by this RFQ');
    }
    if (input.rfqTargetId) {
      const found = eligible.find((t) => t.id === input.rfqTargetId);
      if (!found) throw new ForbiddenException('Invalid RFQ target for seller');
      return found;
    }
    const listingIds = input.items
      .map((i) => i.listingId)
      .filter((id): id is string => Boolean(id));
    if (listingIds.length) {
      const match = eligible.find(
        (t) => t.listingId && listingIds.includes(t.listingId),
      );
      if (match) return match;
    }
    return eligible[0];
  }

  private async assertListingOwnership(
    input: CreateQuoteDraftInput,
    target: { listingId: string | null },
  ) {
    for (const item of input.items) {
      const listingId = item.listingId ?? target.listingId;
      if (!listingId) continue;
      const listing = await this.prisma.listing.findUnique({
        where: { id: listingId },
        select: { organizationId: true },
      });
      if (!listing) throw new BadRequestException(`Invalid listing: ${listingId}`);
      if (listing.organizationId !== input.sellerOrganizationId) {
        throw new ForbiddenException('Listing does not belong to seller');
      }
    }
  }

  private async getRaw(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: QUOTE_INCLUDE,
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }
}
