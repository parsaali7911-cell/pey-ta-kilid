import {
  calculateBuyerDisplayPrice,
  canTransitionQuoteStatus,
  QuoteStatus,
  RoundingMode,
} from '@peytakilid/shared-types';
import { assertNoPrivateLeak } from '../common/contracts/listing-contracts';
import { toAdminQuote, toBuyerQuote, toSellerQuote } from './quote.mapper';
import { QuoteService } from './quote.service';

const sampleRow = {
  id: 'q1',
  publicId: 'qpub',
  status: 'SUBMITTED',
  rfqId: 'rfq1',
  sellerOrganizationId: 'seller1',
  createdByUserId: 'user1',
  currency: 'USD',
  priceType: 'EXW',
  validUntil: null,
  sellerNotes: 'note',
  totalDisplayPrice: 110,
  totalBasePrice: 100,
  submittedAt: new Date('2026-01-02T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
  rfq: { buyerOrganizationId: 'buyer1' },
  items: [
    {
      id: 'qi1',
      rfqItemId: 'ri1',
      listingId: 'lst1',
      productId: 'p1',
      variantId: 'v1',
      quantity: 10,
      uomCode: 'm2',
      basePrice: 10,
      displayPrice: 11,
      currency: 'USD',
      priceType: 'EXW',
      fxRateApplied: 1,
      marginPercentApplied: 10,
      flatFeeApplied: 0,
      leadTimeDays: 7,
      titleSnapshot: 'Tile',
    },
  ],
};

describe('Quote contracts (Phase 0-J)', () => {
  it('enforces quote status transitions', () => {
    expect(canTransitionQuoteStatus(QuoteStatus.DRAFT, QuoteStatus.SUBMITTED)).toBe(true);
    expect(canTransitionQuoteStatus(QuoteStatus.DRAFT, QuoteStatus.ACCEPTED)).toBe(false);
    expect(canTransitionQuoteStatus(QuoteStatus.SUBMITTED, QuoteStatus.REJECTED)).toBe(true);
  });

  it('calculates final buyer price via existing Pricing Engine helper', () => {
    const priced = calculateBuyerDisplayPrice(100, {
      marginPercent: 10,
      flatFee: 0,
      roundingMode: RoundingMode.NONE,
      roundingUnit: null,
      fxRate: 1,
    });
    expect(priced.displayPrice).toBe(110);
    expect(priced.marginPercentApplied).toBe(10);
  });

  it('buyer view hides private seller pricing fields', () => {
    const buyer = toBuyerQuote(sampleRow);
    expect(buyer.seller.name).toBe('Seller');
    expect(buyer.items[0].displayPrice).toBe(11);
    expect(JSON.stringify(buyer)).not.toMatch(
      /basePrice|supplierCost|marginPercentApplied|fxRateApplied|flatFeeApplied|"onHand"/,
    );
    expect(() => assertNoPrivateLeak(buyer)).not.toThrow();
  });

  it('seller view includes basePrice but not inventory/address secrets', () => {
    const seller = toSellerQuote(sampleRow);
    expect(seller.items[0].basePrice).toBe(10);
    expect(seller.totalBasePrice).toBe(100);
    expect(JSON.stringify(seller)).not.toMatch(/"onHand"|"reserved"|"line1"/);
  });

  it('admin view includes full pricing snapshot', () => {
    const admin = toAdminQuote(sampleRow);
    expect(admin.pricingSnapshots[0].marginPercentApplied).toBe(10);
    expect(admin.items[0].fxRateApplied).toBe(1);
  });
});

describe('Quote service authorization + submission', () => {
  function mockService(opts?: {
    rfqStatus?: string;
    noTarget?: boolean;
    otherSellerListing?: boolean;
    quoteStatus?: string;
    validUntil?: Date | null;
  }) {
    const audits: unknown[] = [];
    const notificationEvents: unknown[] = [];
    let inventoryMutations = 0;
    let created: Record<string, unknown> | null = null;
    const pricingCallCount = { n: 0 };

    const targets = opts?.noTarget
      ? []
      : [
          {
            id: 'target1',
            sellerOrganizationId: 'seller1',
            listingId: 'lst1',
          },
        ];

    const baseQuote = () => ({
      id: 'q1',
      publicId: 'qpub',
      status: opts?.quoteStatus ?? 'DRAFT',
      rfqId: 'rfq1',
      sellerOrganizationId: 'seller1',
      createdByUserId: 'user1',
      currency: 'USD',
      priceType: 'EXW',
      validUntil: opts?.validUntil === undefined ? null : opts.validUntil,
      sellerNotes: null,
      totalDisplayPrice: 1100,
      totalBasePrice: 1000,
      submittedAt: opts?.quoteStatus === 'SUBMITTED' ? new Date() : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
      rfq: { buyerOrganizationId: 'buyer1', status: opts?.rfqStatus ?? 'SUBMITTED' },
      items: [
        {
          id: 'qi1',
          rfqItemId: 'ri1',
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
    });

    const prisma: Record<string, unknown> = {
      rfqTarget: {
        findMany: jest.fn(async () => [
          {
            id: 'target1',
            listingId: 'lst1',
            createdAt: new Date(),
            listing: { id: 'lst1', publicId: 'lp', slug: 'tile', title: 'Tile' },
            rfq: {
              id: 'rfq1',
              publicId: 'rp',
              status: 'SUBMITTED',
              market: 'IRAN',
              locale: 'fa',
              submittedAt: new Date(),
              createdAt: new Date(),
              buyerOrganization: { id: 'buyer1', name: 'Buyer', slug: 'buyer' },
              items: [
                {
                  id: 'ri1',
                  listingId: 'lst1',
                  quantity: 10,
                  uomCode: 'm2',
                  titleSnapshot: 'Tile',
                  categoryId: 'c1',
                },
              ],
            },
          },
        ]),
      },
      rfq: {
        findUnique: jest.fn(async () => ({
          id: 'rfq1',
          status: opts?.rfqStatus ?? (created?.status === 'ACCEPTED' ? 'QUOTED' : 'SUBMITTED'),
          buyerOrganizationId: 'buyer1',
          targets,
          items: [{ id: 'ri1', listingId: 'lst1' }],
        })),
        update: jest.fn(async () => ({})),
      },
      listing: {
        findUnique: jest.fn(async () => ({
          organizationId: opts?.otherSellerListing ? 'other' : 'seller1',
        })),
      },
      quote: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created = {
            ...baseQuote(),
            status: 'DRAFT',
            rfqId: data.rfqId,
            sellerOrganizationId: data.sellerOrganizationId,
            createdByUserId: data.createdByUserId,
            currency: data.currency,
            priceType: data.priceType,
            sellerNotes: data.sellerNotes,
            totalDisplayPrice: data.totalDisplayPrice,
            totalBasePrice: data.totalBasePrice,
            submittedAt: null,
          };
          return created;
        }),
        findUnique: jest.fn(async () => {
          if (created) return created;
          created = baseQuote();
          return created;
        }),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const cur = (created ?? baseQuote()) as Record<string, unknown>;
          created = { ...cur, ...data };
          return created;
        }),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      quoteItem: {
        update: jest.fn(async () => ({})),
      },
      inventoryBalance: {
        update: jest.fn(async () => {
          inventoryMutations += 1;
        }),
      },
    };

    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        quoteItem: prisma.quoteItem,
        quote: prisma.quote,
        rfq: prisma.rfq,
      }),
    );

    const orgAccess = {
      requireSellerWriter: jest.fn(async () => ({})),
      requireSellerMember: jest.fn(async () => ({})),
      requireBuyerMember: jest.fn(async () => ({})),
      requireBuyerWriter: jest.fn(async () => ({})),
    };
    const pricing = {
      quote: jest.fn(async ({ supplierCost }: { supplierCost: number }) => {
        pricingCallCount.n += 1;
        return {
          displayPrice: supplierCost * 1.1,
          fxRateApplied: 1,
          marginPercentApplied: 10,
          flatFeeApplied: 0,
        };
      }),
    };
    const audit = {
      record: jest.fn(async (e: unknown) => audits.push(e)),
    };
    const notifications = {
      enqueue: jest.fn(async (e: unknown) => notificationEvents.push(e)),
    };

    const service = new QuoteService(
      prisma as never,
      orgAccess as never,
      pricing as never,
      audit as never,
      notifications as never,
      { acceptQuoteAndCreateOrder: jest.fn() } as never,
    );

    return {
      service,
      orgAccess,
      pricing,
      audits,
      notificationEvents,
      prisma,
      pricingCallCount,
      getInventoryMutations: () => inventoryMutations,
      getCreated: () => created,
    };
  }

  const draftInput = {
    sellerOrganizationId: 'seller1',
    rfqId: 'rfq1',
    currency: 'USD',
    priceType: 'EXW',
    items: [
      {
        rfqItemId: 'ri1',
        listingId: 'lst1',
        quantity: 10,
        uomCode: 'm2',
        basePrice: 100,
        leadTimeDays: 7,
        titleSnapshot: 'Tile',
      },
    ],
  };

  it('creates quote draft with seller auth, target enforcement, pricing snapshot', async () => {
    const { service, orgAccess, pricing, audits, notificationEvents } = mockService();
    const quote = await service.createDraft('user1', draftInput);
    expect(orgAccess.requireSellerWriter).toHaveBeenCalledWith('user1', 'seller1');
    expect(pricing.quote).toHaveBeenCalledWith(
      expect.objectContaining({ supplierCost: 100, currency: 'USD' }),
    );
    expect(quote.status).toBe(QuoteStatus.DRAFT);
    expect(quote.items[0].basePrice).toBe(100);
    expect(quote.items[0].displayPrice).toBe(110);
    expect(audits[0]).toEqual(expect.objectContaining({ action: 'QUOTE_CREATED' }));
    expect(notificationEvents[0]).toEqual(
      expect.objectContaining({ type: 'QUOTE_CREATED' }),
    );
  });

  it('rejects quotes when RFQ not submitted', async () => {
    const { service } = mockService({ rfqStatus: 'DRAFT' });
    await expect(service.createDraft('user1', draftInput)).rejects.toThrow(/SUBMITTED/);
  });

  it('rejects sellers not in RfqTarget', async () => {
    const { service } = mockService({ noTarget: true });
    await expect(service.createDraft('user1', draftInput)).rejects.toThrow(/not targeted/);
  });

  it('rejects listing owned by another seller', async () => {
    const { service } = mockService({ otherSellerListing: true });
    await expect(service.createDraft('user1', draftInput)).rejects.toThrow(
      /does not belong/,
    );
  });

  it('submits quote with immutable resnapshot + RFQ→QUOTED + hooks', async () => {
    const ctx = mockService();
    await ctx.service.createDraft('user1', draftInput);
    const submitted = await ctx.service.submit('user1', 'q1');
    expect(submitted.status).toBe(QuoteStatus.SUBMITTED);
    expect(ctx.pricing.quote).toHaveBeenCalled();
    expect(ctx.audits.some((a) => (a as { action: string }).action === 'QUOTE_SUBMITTED')).toBe(
      true,
    );
    expect(
      ctx.notificationEvents.some((n) => (n as { type: string }).type === 'QUOTE_SUBMITTED'),
    ).toBe(true);
    expect(
      (ctx.prisma.rfq as { update: jest.Mock }).update,
    ).toHaveBeenCalled();
  });

  it('rejects invalid quote status transition on submit', async () => {
    const { service } = mockService({ quoteStatus: 'SUBMITTED' });
    await expect(service.submit('user1', 'q1')).rejects.toThrow(/Cannot submit/);
  });

  it('buyer cannot see private fields; seller cannot use buyer endpoints for drafts', async () => {
    const ctx = mockService();
    await ctx.service.createDraft('user1', draftInput);
    ctx.prisma.quote = {
      ...(ctx.prisma.quote as object),
      findMany: jest.fn(async () => [
        {
          ...((await (ctx.prisma.quote as { findUnique: () => Promise<unknown> }).findUnique()) as object),
          status: 'SUBMITTED',
        },
      ]),
    } as never;
    const buyerList = await ctx.service.listBuyerQuotesForRfq('buyerUser', 'rfq1');
    expect(ctx.orgAccess.requireBuyerMember).toHaveBeenCalled();
    expect(JSON.stringify(buyerList)).not.toMatch(/basePrice|marginPercentApplied/);

    await expect(ctx.service.getBuyerQuote('buyerUser', 'q1')).rejects.toThrow(
      /not available/,
    );
  });

  it('does not mutate inventory on create/submit', async () => {
    const ctx = mockService();
    await ctx.service.createDraft('user1', draftInput);
    await ctx.service.submit('user1', 'q1');
    expect(ctx.getInventoryMutations()).toBe(0);
    expect(
      (ctx.prisma.inventoryBalance as { update: jest.Mock }).update,
    ).not.toHaveBeenCalled();
  });
});

describe('Quote accept / reject / cancel / expire', () => {
  function mockService(opts?: {
    quoteStatus?: string;
    rfqStatus?: string;
    validUntil?: Date | null;
  }) {
    const audits: unknown[] = [];
    const notificationEvents: unknown[] = [];
    let inventoryMutations = 0;
    let created: Record<string, unknown> = {
      id: 'q1',
      publicId: 'qpub',
      status: opts?.quoteStatus ?? 'SUBMITTED',
      rfqId: 'rfq1',
      sellerOrganizationId: 'seller1',
      createdByUserId: 'user1',
      currency: 'USD',
      priceType: 'EXW',
      validUntil: opts?.validUntil === undefined ? null : opts.validUntil,
      sellerNotes: null,
      totalDisplayPrice: 1100,
      totalBasePrice: 1000,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
      rfq: {
        buyerOrganizationId: 'buyer1',
        status: opts?.rfqStatus ?? 'QUOTED',
      },
      items: [
        {
          id: 'qi1',
          rfqItemId: 'ri1',
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
    };

    const prisma: Record<string, unknown> = {
      rfq: {
        findUnique: jest.fn(async () => ({
          id: 'rfq1',
          status: opts?.rfqStatus ?? 'QUOTED',
          buyerOrganizationId: 'buyer1',
        })),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      },
      quote: {
        findUnique: jest.fn(async () => created),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created = { ...created, ...data };
          return created;
        }),
        updateMany: jest.fn(async () => ({ count: 1 })),
        findMany: jest.fn(async () => []),
      },
      quoteItem: { update: jest.fn(async () => ({})) },
      inventoryBalance: {
        update: jest.fn(async () => {
          inventoryMutations += 1;
        }),
      },
      inventoryReservation: {
        create: jest.fn(async () => {
          inventoryMutations += 1;
        }),
      },
    };

    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        quote: prisma.quote,
        rfq: prisma.rfq,
        quoteItem: prisma.quoteItem,
      }),
    );

    const orgAccess = {
      requireSellerWriter: jest.fn(async () => ({})),
      requireSellerMember: jest.fn(async () => ({})),
      requireBuyerMember: jest.fn(async () => ({})),
      requireBuyerWriter: jest.fn(async () => ({})),
    };
    const pricing = {
      quote: jest.fn(async () => {
        throw new Error('PricingEngine must not run on accept/reject');
      }),
    };
    const audit = {
      record: jest.fn(async (e: unknown) => audits.push(e)),
    };
    const notifications = {
      enqueue: jest.fn(async (e: unknown) => notificationEvents.push(e)),
    };
    const orders = {
      acceptQuoteAndCreateOrder: jest.fn(async () => {
        created = { ...created, status: 'ACCEPTED' };
        return { id: 'o1', quoteId: 'q1' };
      }),
    };

    const service = new QuoteService(
      prisma as never,
      orgAccess as never,
      pricing as never,
      audit as never,
      notifications as never,
      orders as never,
    );

    return {
      service,
      orgAccess,
      pricing,
      audits,
      notificationEvents,
      prisma,
      orders,
      getCreated: () => created,
      getInventoryMutations: () => inventoryMutations,
    };
  }

  it('enforces valid and invalid accept/reject transitions', () => {
    expect(canTransitionQuoteStatus(QuoteStatus.SUBMITTED, QuoteStatus.ACCEPTED)).toBe(true);
    expect(canTransitionQuoteStatus(QuoteStatus.SUBMITTED, QuoteStatus.REJECTED)).toBe(true);
    expect(canTransitionQuoteStatus(QuoteStatus.SUBMITTED, QuoteStatus.EXPIRED)).toBe(true);
    expect(canTransitionQuoteStatus(QuoteStatus.SUBMITTED, QuoteStatus.CANCELLED)).toBe(true);
    expect(canTransitionQuoteStatus(QuoteStatus.ACCEPTED, QuoteStatus.REJECTED)).toBe(false);
    expect(canTransitionQuoteStatus(QuoteStatus.REJECTED, QuoteStatus.ACCEPTED)).toBe(false);
    expect(canTransitionQuoteStatus(QuoteStatus.DRAFT, QuoteStatus.ACCEPTED)).toBe(false);
  });

  it('accept delegates to OrderService commercial close and returns Order', async () => {
    const ctx = mockService({ quoteStatus: 'SUBMITTED', rfqStatus: 'QUOTED' });
    const accepted = await ctx.service.accept('buyerUser', 'q1');
    expect(ctx.orders.acceptQuoteAndCreateOrder).toHaveBeenCalledWith('buyerUser', 'q1');
    expect(accepted).toEqual({ id: 'o1', quoteId: 'q1' });
    expect(JSON.stringify(accepted)).not.toMatch(/basePrice|marginPercentApplied/);
    expect(ctx.pricing.quote).not.toHaveBeenCalled();
    expect(ctx.getInventoryMutations()).toBe(0);
  });

  it('buyer rejects submitted quote without repricing or inventory mutation', async () => {
    const ctx = mockService({ quoteStatus: 'SUBMITTED', rfqStatus: 'QUOTED' });
    const rejected = await ctx.service.reject('buyerUser', 'q1');
    expect(ctx.orgAccess.requireBuyerWriter).toHaveBeenCalledWith('buyerUser', 'buyer1');
    expect(rejected.status).toBe(QuoteStatus.REJECTED);
    expect(ctx.pricing.quote).not.toHaveBeenCalled();
    expect(ctx.getInventoryMutations()).toBe(0);
    expect(ctx.audits.some((a) => (a as { action: string }).action === 'QUOTE_REJECTED')).toBe(
      true,
    );
  });

  it('seller cancels own submitted quote', async () => {
    const ctx = mockService({ quoteStatus: 'SUBMITTED' });
    const cancelled = await ctx.service.cancel('sellerUser', 'q1');
    expect(ctx.orgAccess.requireSellerWriter).toHaveBeenCalledWith('sellerUser', 'seller1');
    expect(cancelled.status).toBe(QuoteStatus.CANCELLED);
    expect(ctx.getInventoryMutations()).toBe(0);
  });

  it('cannot cancel accepted quote', async () => {
    const { service } = mockService({ quoteStatus: 'ACCEPTED' });
    await expect(service.cancel('sellerUser', 'q1')).rejects.toThrow(/Cannot cancel/);
  });
});
