import {
  canTransitionOrderStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@peytakilid/shared-types';
import { assertNoPrivateLeak } from '../common/contracts/listing-contracts';
import { OrderService } from './order.service';
import { toAdminOrder, toBuyerOrder, toSellerOrder } from './order.mapper';

const sampleOrder = {
  id: 'o1',
  publicId: 'opub',
  status: 'AWAITING_PAYMENT',
  rfqId: 'rfq1',
  quoteId: 'q1',
  buyerOrganizationId: 'buyer1',
  sellerOrganizationId: 'seller1',
  currency: 'USD',
  priceType: 'EXW',
  totalDisplayPrice: 1100,
  totalBasePrice: 1000,
  confirmedAt: new Date('2026-01-02T00:00:00Z'),
  createdAt: new Date('2026-01-02T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  buyerOrganization: { id: 'buyer1', name: 'Buyer', slug: 'buyer' },
  sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
  items: [
    {
      id: 'oi1',
      quoteItemId: 'qi1',
      listingId: 'lst1',
      productId: 'p1',
      variantId: 'v1',
      facilityId: 'fac1',
      quantity: 10,
      uomCode: 'm2',
      basePrice: 100,
      displayPrice: 110,
      currency: 'USD',
      priceType: 'EXW',
      fxRateApplied: 1,
      marginPercentApplied: 10,
      flatFeeApplied: 0,
      leadTimeDays: 7,
      titleSnapshot: 'Tile',
      lineDisplayTotal: 1100,
      lineBaseTotal: 1000,
    },
  ],
};

describe('Order contracts (commerce foundation)', () => {
  it('enforces order status transitions', () => {
    expect(
      canTransitionOrderStatus(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID),
    ).toBe(true);
    expect(canTransitionOrderStatus(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
  });

  it('buyer view hides private seller cost fields', () => {
    const buyer = toBuyerOrder(sampleOrder);
    expect(buyer.seller.id).toBe('seller1');
    expect(buyer.quoteId).toBe('q1');
    expect(buyer.rfqId).toBe('rfq1');
    expect(buyer.items[0].facilityId).toBe('fac1');
    expect(JSON.stringify(buyer)).not.toMatch(
      /basePrice|totalBasePrice|marginPercentApplied|fxRateApplied|flatFeeApplied|supplierCost/,
    );
    expect(() => assertNoPrivateLeak(buyer)).not.toThrow();
  });

  it('seller/admin views retain snapshot internals', () => {
    expect(toSellerOrder(sampleOrder).totalBasePrice).toBe(1000);
    expect(toAdminOrder(sampleOrder).items[0].marginPercentApplied).toBe(10);
  });
});

describe('OrderService accept → order → reserve → payment', () => {
  function mockCtx(opts?: {
    quoteStatus?: string;
    onHand?: number;
    reserved?: number;
    existingOrder?: boolean;
    insufficient?: boolean;
  }) {
    const audits: unknown[] = [];
    const notifications: unknown[] = [];
    const erpEvents: unknown[] = [];
    let orderRow: Record<string, unknown> | null = opts?.existingOrder
      ? { ...sampleOrder, id: 'o1' }
      : null;
    let paymentRow: Record<string, unknown> | null = null;
    let balance = {
      listingId: 'lst1',
      onHand: opts?.insufficient ? 1 : (opts?.onHand ?? 100),
      reserved: opts?.reserved ?? 0,
      uomCode: 'm2',
    };
    const reservations: unknown[] = [];

    const quoteRow = {
      id: 'q1',
      publicId: 'qpub',
      status: opts?.quoteStatus ?? 'SUBMITTED',
      rfqId: 'rfq1',
      sellerOrganizationId: 'seller1',
      createdByUserId: 'sellerUser',
      currency: 'USD',
      priceType: 'EXW',
      validUntil: null,
      totalDisplayPrice: 1100,
      totalBasePrice: 1000,
      sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
      rfq: { id: 'rfq1', buyerOrganizationId: 'buyer1', status: 'QUOTED' },
      items: [
        {
          id: 'qi1',
          listingId: 'lst1',
          productId: 'p1',
          variantId: 'v1',
          quantity: 10,
          uomCode: 'm2',
          basePrice: 100,
          displayPrice: 110,
          currency: 'USD',
          priceType: 'EXW',
          fxRateApplied: 1,
          marginPercentApplied: 10,
          flatFeeApplied: 0,
          leadTimeDays: 7,
          titleSnapshot: 'Tile',
        },
      ],
      order: orderRow ? { id: 'o1' } : null,
    };

    const tx = {
      quote: {
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(quoteRow, data);
          return quoteRow;
        }),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      rfq: {
        findUnique: jest.fn(async () => ({ id: 'rfq1', status: 'QUOTED' })),
        update: jest.fn(async () => ({})),
      },
      order: {
        findUnique: jest.fn(async () => orderRow),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const items = (
            data.items as { create: Array<Record<string, unknown>> }
          ).create.map((it, i) => ({
            id: `oi${i + 1}`,
            ...it,
          }));
          orderRow = {
            id: 'o1',
            publicId: 'opub',
            status: data.status,
            quoteId: data.quoteId,
            rfqId: data.rfqId,
            buyerOrganizationId: data.buyerOrganizationId,
            sellerOrganizationId: data.sellerOrganizationId,
            createdByUserId: data.createdByUserId,
            currency: data.currency,
            priceType: data.priceType,
            totalDisplayPrice: data.totalDisplayPrice,
            totalBasePrice: data.totalBasePrice,
            paymentTermsCode: data.paymentTermsCode,
            confirmedAt: data.confirmedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            buyerOrganization: { id: 'buyer1', name: 'Buyer', slug: 'buyer' },
            sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
            items,
          };
          return orderRow;
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          orderRow = { ...(orderRow as object), ...data };
          return orderRow;
        }),
      },
      orderPaymentSchedule: {
        create: jest.fn(async () => ({ id: 'sch1' })),
      },
      inventoryBalance: {
        findUnique: jest.fn(async () => balance),
        create: jest.fn(async ({ data }: { data: typeof balance }) => {
          balance = { ...data };
          return balance;
        }),
        update: jest.fn(async (args: { where?: unknown; data: { reserved: number } }) => {
          balance = { ...balance, reserved: args.data.reserved };
          return balance;
        }),
      },
      inventoryReservation: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `res-${reservations.length + 1}`, status: 'ACTIVE', ...data };
          reservations.push(row);
          return row;
        }),
      },
      inventoryLedgerEntry: {
        create: jest.fn(async (_args?: unknown) => ({})),
      },
      payment: {
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          paymentRow = { ...(paymentRow as object), ...data };
          return paymentRow;
        }),
        aggregate: jest.fn(async () => ({
          _sum: { amount: paymentRow ? Number(paymentRow.amount) : 0 },
        })),
      },
    };

    const prisma: Record<string, unknown> = {
      quote: {
        findUnique: jest.fn(async () => quoteRow),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(quoteRow, data);
          return quoteRow;
        }),
      },
      listing: {
        findMany: jest.fn(async () => [
          {
            id: 'lst1',
            facilityId: 'fac1',
            uomCode: 'm2',
            organizationId: 'seller1',
          },
        ]),
      },
      order: {
        findUnique: jest.fn(async ({ where }: { where: { id?: string; quoteId?: string } }) => {
          if (where.quoteId && orderRow && orderRow.quoteId === where.quoteId) return orderRow;
          if (where.id && orderRow && orderRow.id === where.id) return orderRow;
          return orderRow && where.id === 'o1' ? orderRow : orderRow;
        }),
        findMany: jest.fn(async () => (orderRow ? [orderRow] : [])),
        update: tx.order.update,
      },
      payment: {
        findUnique: jest.fn(async ({ where }: { where: { idempotencyKey?: string; id?: string } }) => {
          if (where.idempotencyKey && paymentRow?.idempotencyKey === where.idempotencyKey) {
            return paymentRow;
          }
          if (where.id && paymentRow?.id === where.id) return paymentRow;
          return null;
        }),
        findFirst: jest.fn(async () => paymentRow ?? null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          paymentRow = {
            id: 'pay1',
            publicId: 'ppub',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            confirmedAt: null,
            verifiedByUserId: null,
          };
          return paymentRow;
        }),
      },
      erpOutboxEvent: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: unknown }) => {
          erpEvents.push(data);
          return { id: `erp-${erpEvents.length}`, ...(data as object) };
        }),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
        const snapshot = orderRow;
        try {
          return await fn(tx);
        } catch (err) {
          orderRow = snapshot;
          throw err;
        }
      }),
    };

    // After create, findUnique by id should return full include shape
    (prisma.order as { findUnique: jest.Mock }).findUnique.mockImplementation(
      async ({ where }: { where: { id?: string; quoteId?: string } }) => {
        if (!orderRow) return null;
        if (where.quoteId) return orderRow.quoteId === where.quoteId ? orderRow : null;
        if (where.id) return orderRow.id === where.id ? orderRow : null;
        return orderRow;
      },
    );

    const orgAccess = {
      requireBuyerWriter: jest.fn(async () => ({})),
      requireBuyerMember: jest.fn(async () => ({})),
      requireSellerMember: jest.fn(async () => ({})),
      requireSellerWriter: jest.fn(async () => ({})),
    };

    const inventory = {
      reserveInTx: jest.fn(async (transaction: typeof tx, input: {
        listingId: string;
        quantity: number;
        uomCode: string;
        orderId: string;
        orderItemId: string;
        actorUserId: string;
      }) => {
        const avail = Number(balance.onHand) - Number(balance.reserved);
        if (input.quantity > avail) throw new Error('Insufficient available quantity');
        const reservation = await transaction.inventoryReservation.create({
          data: {
            listingId: input.listingId,
            quantity: input.quantity,
            uomCode: input.uomCode,
            orderId: input.orderId,
            orderItemId: input.orderItemId,
            status: 'ACTIVE',
          },
        });
        balance.reserved = Number(balance.reserved) + input.quantity;
        await transaction.inventoryBalance.update({
          where: { listingId: input.listingId },
          data: { reserved: balance.reserved },
        });
        await transaction.inventoryLedgerEntry.create({
          data: {
            listingId: input.listingId,
            type: 'RESERVE',
            quantity: input.quantity,
            uomCode: input.uomCode,
            balanceOnHandAfter: balance.onHand,
            balanceReservedAfter: balance.reserved,
            reservationId: (reservation as { id: string }).id,
            actorUserId: input.actorUserId,
          },
        });
        return { reservation, balance, idempotent: false };
      }),
    };

    const audit = { record: jest.fn(async (e: unknown) => audits.push(e)) };
    const notificationService = {
      enqueue: jest.fn(async (e: unknown) => notifications.push(e)),
    };
    const erpOutbox = {
      enqueueSafe: jest.fn(async (e: unknown) => {
        erpEvents.push(e);
        return e;
      }),
    };

    const service = new OrderService(
      prisma as never,
      orgAccess as never,
      inventory as never,
      audit as never,
      notificationService as never,
      erpOutbox as never,
    );

    return {
      service,
      orgAccess,
      inventory,
      audits,
      notifications,
      erpEvents,
      prisma,
      tx,
      getOrder: () => orderRow,
      getBalance: () => balance,
      getReservations: () => reservations,
      getPayment: () => paymentRow,
      setPaymentForConfirm: () => {
        paymentRow = {
          id: 'pay1',
          publicId: 'ppub',
          orderId: 'o1',
          idempotencyKey: 'idem-1',
          method: 'BANK_TRANSFER',
          status: 'SUBMITTED',
          amount: 1100,
          currency: 'USD',
          reference: null,
          submittedAt: new Date(),
          confirmedAt: null,
          verifiedByUserId: null,
          order: {
            id: 'o1',
            buyerOrganizationId: 'buyer1',
            totalDisplayPrice: 1100,
          },
        };
        (prisma.payment as { findUnique: jest.Mock }).findUnique.mockImplementation(
          async () => paymentRow,
        );
      },
    };
  }

  it('accepted quote creates exactly one order with immutable snapshot + reservation', async () => {
    const ctx = mockCtx();
    const order = await ctx.service.acceptQuoteAndCreateOrder('buyerUser', 'q1');
    expect(ctx.orgAccess.requireBuyerWriter).toHaveBeenCalledWith('buyerUser', 'buyer1');
    expect(order.quoteId).toBe('q1');
    expect(order.rfqId).toBe('rfq1');
    expect(order.seller.id).toBe('seller1');
    expect(order.buyer.id).toBe('buyer1');
    expect(order.items[0].listingId).toBe('lst1');
    expect(order.items[0].productId).toBe('p1');
    expect(order.items[0].variantId).toBe('v1');
    expect(order.items[0].facilityId).toBe('fac1');
    expect(order.items[0].displayPrice).toBe(110);
    expect(order.totalDisplayPrice).toBe(1100);
    expect(JSON.stringify(order)).not.toMatch(/basePrice|totalBasePrice|marginPercent/);
    expect(ctx.inventory.reserveInTx).toHaveBeenCalledTimes(1);
    expect(ctx.getBalance().reserved).toBe(10);
    expect(ctx.getReservations()).toHaveLength(1);
    expect(ctx.erpEvents.some((e) => (e as { jobType: string }).jobType === 'SYNC_ORDER')).toBe(
      true,
    );
    expect(ctx.audits.some((a) => (a as { action: string }).action === 'ORDER_CREATED')).toBe(
      true,
    );
  });

  it('duplicate accept returns same order (idempotent) without double reserve', async () => {
    const ctx = mockCtx();
    const first = await ctx.service.acceptQuoteAndCreateOrder('buyerUser', 'q1');
    // Simulate accepted + existing order
    const quoteFind = (ctx.prisma.quote as { findUnique: jest.Mock }).findUnique;
    quoteFind.mockImplementation(async () => ({
      id: 'q1',
      status: 'ACCEPTED',
      rfqId: 'rfq1',
      sellerOrganizationId: 'seller1',
      currency: 'USD',
      priceType: 'EXW',
      validUntil: null,
      totalDisplayPrice: 1100,
      totalBasePrice: 1000,
      sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
      rfq: { id: 'rfq1', buyerOrganizationId: 'buyer1', status: 'ACCEPTED' },
      items: [],
      order: { id: first.id },
    }));
    const reserveCalls = ctx.inventory.reserveInTx.mock.calls.length;
    const second = await ctx.service.acceptQuoteAndCreateOrder('buyerUser', 'q1');
    expect(second.id).toBe(first.id);
    expect(ctx.inventory.reserveInTx.mock.calls.length).toBe(reserveCalls);
  });

  it('rejects insufficient inventory', async () => {
    const ctx = mockCtx({ insufficient: true });
    await expect(ctx.service.acceptQuoteAndCreateOrder('buyerUser', 'q1')).rejects.toThrow(
      /Insufficient/,
    );
    expect(ctx.getOrder()).toBeNull();
  });

  it('rejects invalid quote status', async () => {
    const ctx = mockCtx({ quoteStatus: 'DRAFT' });
    await expect(ctx.service.acceptQuoteAndCreateOrder('buyerUser', 'q1')).rejects.toThrow(
      /Cannot accept/,
    );
  });

  it('seller cannot access buyer order without buyer membership', async () => {
    const ctx = mockCtx();
    await ctx.service.acceptQuoteAndCreateOrder('buyerUser', 'q1');
    ctx.orgAccess.requireBuyerMember.mockRejectedValue(new Error('Not buyer'));
    await expect(ctx.service.getBuyerOrder('sellerUser', 'o1')).rejects.toThrow(/Not buyer/);
  });

  it('historical order snapshot unchanged when pricing would differ', async () => {
    const ctx = mockCtx();
    const order = await ctx.service.acceptQuoteAndCreateOrder('buyerUser', 'q1');
    // Pricing engine not invoked; snapshot frozen at quote values
    expect(order.items[0].displayPrice).toBe(110);
    expect(ctx.getOrder()?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayPrice: 110,
          basePrice: 100,
          marginPercentApplied: 10,
        }),
      ]),
    );
  });

  it('payment submit is idempotent; confirm marks order PAID + ERP outbox', async () => {
    const ctx = mockCtx();
    await ctx.service.acceptQuoteAndCreateOrder('buyerUser', 'q1');

    const p1 = await ctx.service.submitPayment('buyerUser', {
      orderId: 'o1',
      amount: 1100,
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: 'idem-1',
    });
    const p2 = await ctx.service.submitPayment('buyerUser', {
      orderId: 'o1',
      amount: 1100,
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: 'idem-1',
    });
    expect(p1.id).toBe(p2.id);
    expect(p1.status).toBe(PaymentStatus.SUBMITTED);

    ctx.setPaymentForConfirm();
    const confirmed = await ctx.service.confirmPayment('admin1', 'pay1');
    expect(confirmed.status).toBe(PaymentStatus.CONFIRMED);
    expect(ctx.getOrder()?.status).toBe(OrderStatus.PAID);
    expect(ctx.erpEvents.some((e) => (e as { jobType: string }).jobType === 'SYNC_PAYMENT')).toBe(
      true,
    );
  });
});
