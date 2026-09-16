import {
  canTransitionRfqStatus,
  RequestIntent,
  RfqStatus,
  snapshotRequirements,
  StructuredRequirements,
} from '@peytakilid/shared-types';
import { assertNoPrivateLeak } from '../common/contracts/listing-contracts';
import { toPublicRfq } from './rfq.mapper';
import { RfqService } from './rfq.service';

function baseRequirements(
  overrides: Partial<StructuredRequirements> = {},
): StructuredRequirements {
  return {
    intent: RequestIntent.PRODUCT,
    market: 'IRAN',
    locale: 'fa',
    quantity: 100,
    uomCode: 'm2',
    categoryHints: ['tile'],
    attributeFilters: { color: 'beige' },
    budget: { min: 10, max: 200, currency: 'USD' },
    location: { city: 'Tehran', countryCode: 'IR' },
    facilityProximity: null,
    listingIdHints: ['lst_1'],
    specialtyHints: [],
    confidence: 0.9,
    missingFields: [],
    rawText: null,
    ...overrides,
  };
}

describe('RFQ contracts (Phase 0-I)', () => {
  it('StructuredRequirements → RFQ draft contract', () => {
    const service = new RfqService({} as never, {} as never, {} as never, {} as never);
    const req = baseRequirements({ locale: 'en' });
    const draft = service.draftFromRequirements(req, ['lst_1'], 'notes');
    expect(draft.status).toBe('draft_contract');
    expect(draft.suggestedListingIds).toEqual(['lst_1']);
    expect(draft.requirements.quantity).toBe(100);
    expect(draft.requirements).not.toBe(req);
    expect(draft.requirements).toEqual(req);
  });

  it('snapshots requirements immutably', () => {
    const req = baseRequirements();
    const snap = snapshotRequirements(req);
    snap.quantity = 1;
    expect(req.quantity).toBe(100);
  });

  it('enforces RFQ status transitions', () => {
    expect(canTransitionRfqStatus(RfqStatus.DRAFT, RfqStatus.SUBMITTED)).toBe(true);
    expect(canTransitionRfqStatus(RfqStatus.DRAFT, RfqStatus.ACCEPTED)).toBe(false);
    expect(canTransitionRfqStatus(RfqStatus.SUBMITTED, RfqStatus.QUOTED)).toBe(true);
    expect(canTransitionRfqStatus(RfqStatus.CANCELLED, RfqStatus.DRAFT)).toBe(false);
  });

  it('public RFQ DTO does not leak private pricing/inventory/address', () => {
    const pub = toPublicRfq({
      id: 'rfq1',
      publicId: 'pub1',
      status: 'DRAFT',
      buyerOrganizationId: 'buyer1',
      createdByUserId: 'user1',
      requirementsSnapshot: baseRequirements({ locale: 'ar' }),
      buyerNotes: null,
      market: 'IRAN',
      locale: 'ar',
      budgetMin: 10,
      budgetMax: 100,
      budgetCurrency: 'USD',
      destinationCountryCode: 'IR',
      destinationRegion: null,
      destinationProvince: null,
      destinationCity: 'Tehran',
      requestedLeadTimeDays: 14,
      submittedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      buyerOrganization: { id: 'buyer1', name: 'Buyer Co', slug: 'buyer-co' },
      items: [
        {
          id: 'item1',
          listingId: 'lst1',
          productId: 'p1',
          variantId: 'v1',
          categoryId: 'c1',
          sellerOrganizationId: 'seller1',
          titleSnapshot: 'Tile',
          quantity: 50,
          uomCode: 'm2',
          attributeFilters: { color: 'beige' },
          listing: { publicId: 'lpub', slug: 'tile' },
          sellerOrganization: { id: 'seller1', name: 'Seller Co', slug: 'seller-co' },
        },
      ],
      targets: [
        {
          id: 't1',
          sellerOrganizationId: 'seller1',
          listingId: 'lst1',
          sellerOrganization: { id: 'seller1', name: 'Seller Co', slug: 'seller-co' },
        },
      ],
    });

    expect(pub.buyer.organizationId).toBe('buyer1');
    expect(pub.items[0].sellerOrganizationPublic?.name).toBe('Seller Co');
    expect(pub.requirementsSnapshot.locale).toBe('ar');
    expect(JSON.stringify(pub)).not.toMatch(/supplierCost|"onHand"|"reserved"|"line1"|margin/i);
    expect(() => assertNoPrivateLeak(pub)).not.toThrow();
  });
});

describe('RFQ service authorization + submission', () => {
  function mockService(opts?: {
    listingStatus?: string;
    missingListing?: boolean;
    rfqStatus?: string;
  }) {
    const audits: unknown[] = [];
    const notificationEvents: unknown[] = [];
    let inventoryMutations = 0;
    let priceMutations = 0;
    let createdRfq: Record<string, unknown> | null = null;

    const listing = {
      id: 'lst1',
      publicId: 'lpub',
      slug: 'tile',
      title: 'Tile',
      organizationId: 'seller1',
      categoryId: 'c1',
      productId: 'p1',
      variantId: 'v1',
      uomCode: 'm2',
      status: opts?.listingStatus ?? 'PUBLISHED',
      organization: { id: 'seller1', name: 'Seller', slug: 'seller' },
    };

    const prisma = {
      listing: {
        findMany: jest.fn(async () => (opts?.missingListing ? [] : [listing])),
      },
      organization: {
        findMany: jest.fn(async () => [
          { id: 'seller1', name: 'Seller', slug: 'seller' },
        ]),
      },
      rfq: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          createdRfq = {
            id: 'rfq1',
            publicId: 'rpub',
            status: 'DRAFT',
            buyerOrganizationId: data.buyerOrganizationId,
            createdByUserId: data.createdByUserId,
            requirementsSnapshot: data.requirementsSnapshot,
            buyerNotes: data.buyerNotes,
            market: data.market,
            locale: data.locale,
            budgetMin: data.budgetMin,
            budgetMax: data.budgetMax,
            budgetCurrency: data.budgetCurrency,
            destinationCountryCode: data.destinationCountryCode,
            destinationRegion: data.destinationRegion,
            destinationProvince: data.destinationProvince,
            destinationCity: data.destinationCity,
            requestedLeadTimeDays: null,
            submittedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            buyerOrganization: { id: 'buyer1', name: 'Buyer', slug: 'buyer' },
            items: [
              {
                id: 'item1',
                listingId: 'lst1',
                productId: 'p1',
                variantId: 'v1',
                categoryId: 'c1',
                sellerOrganizationId: 'seller1',
                titleSnapshot: 'Tile',
                quantity: 100,
                uomCode: 'm2',
                attributeFilters: { color: 'beige' },
                listing: { publicId: 'lpub', slug: 'tile' },
              },
            ],
            targets: [
              {
                id: 't1',
                sellerOrganizationId: 'seller1',
                listingId: 'lst1',
                sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
              },
            ],
          };
          return createdRfq;
        }),
        findUnique: jest.fn(async () => {
          if (!createdRfq) {
            return {
              id: 'rfq1',
              publicId: 'rpub',
              status: opts?.rfqStatus ?? 'DRAFT',
              buyerOrganizationId: 'buyer1',
              createdByUserId: 'user1',
              requirementsSnapshot: baseRequirements(),
              buyerNotes: null,
              market: 'IRAN',
              locale: 'fa',
              budgetMin: 10,
              budgetMax: 200,
              budgetCurrency: 'USD',
              destinationCountryCode: 'IR',
              destinationRegion: null,
              destinationProvince: null,
              destinationCity: 'Tehran',
              requestedLeadTimeDays: null,
              submittedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              buyerOrganization: { id: 'buyer1', name: 'Buyer', slug: 'buyer' },
              items: [
                {
                  id: 'item1',
                  listingId: 'lst1',
                  productId: 'p1',
                  variantId: 'v1',
                  categoryId: 'c1',
                  sellerOrganizationId: 'seller1',
                  titleSnapshot: 'Tile',
                  quantity: 100,
                  uomCode: 'm2',
                  attributeFilters: null,
                  listing: { publicId: 'lpub', slug: 'tile' },
                },
              ],
              targets: [
                {
                  id: 't1',
                  sellerOrganizationId: 'seller1',
                  listingId: 'lst1',
                  sellerOrganization: { id: 'seller1', name: 'Seller', slug: 'seller' },
                },
              ],
            };
          }
          return createdRfq;
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const current = (await prisma.rfq.findUnique()) as Record<string, unknown>;
          return {
            ...current,
            ...data,
            updatedAt: new Date(),
          };
        }),
        findMany: jest.fn(async () => []),
      },
      // Prove inventory/pricing tables are never touched by RFQ service
      inventoryBalance: {
        update: jest.fn(async () => {
          inventoryMutations += 1;
        }),
      },
      listingPrice: {
        update: jest.fn(async () => {
          priceMutations += 1;
        }),
      },
    };

    const orgAccess = {
      requireBuyerWriter: jest.fn(async () => ({})),
      requireBuyerMember: jest.fn(async () => ({})),
    };
    const audit = {
      record: jest.fn(async (e: unknown) => {
        audits.push(e);
      }),
    };
    const notifications = {
      enqueue: jest.fn(async (e: unknown) => {
        notificationEvents.push(e);
      }),
    };

    const service = new RfqService(
      prisma as never,
      orgAccess as never,
      audit as never,
      notifications as never,
    );

    return {
      service,
      orgAccess,
      audits,
      notifications: notificationEvents,
      prisma,
      getInventoryMutations: () => inventoryMutations,
      getPriceMutations: () => priceMutations,
    };
  }

  it('creates draft from SearchHit listing ids with buyer auth + seller targeting', async () => {
    const { service, orgAccess, audits, notifications } = mockService();
    const rfq = await service.createDraft('user1', {
      buyerOrganizationId: 'buyer1',
      requirements: baseRequirements({ locale: 'fa' }),
      selectedListingIds: ['lst1'],
      buyerNotes: null,
    });

    expect(orgAccess.requireBuyerWriter).toHaveBeenCalledWith('user1', 'buyer1');
    expect(rfq.status).toBe(RfqStatus.DRAFT);
    expect(rfq.buyer.organizationId).toBe('buyer1');
    expect(rfq.items[0].listingId).toBe('lst1');
    expect(rfq.items[0].sellerOrganizationId).toBe('seller1');
    expect(rfq.targets[0].sellerOrganizationId).toBe('seller1');
    expect(rfq.requirementsSnapshot.locale).toBe('fa');
    expect(audits[0]).toEqual(expect.objectContaining({ action: 'RFQ_CREATED' }));
    expect(notifications[0]).toEqual(expect.objectContaining({ type: 'RFQ_CREATED' }));
  });

  it('rejects invalid listing references', async () => {
    const { service } = mockService({ missingListing: true });
    await expect(
      service.createDraft('user1', {
        buyerOrganizationId: 'buyer1',
        requirements: baseRequirements(),
        selectedListingIds: ['missing'],
      }),
    ).rejects.toThrow(/Invalid listing/);
  });

  it('rejects unpublished listings', async () => {
    const { service } = mockService({ listingStatus: 'DRAFT' });
    await expect(
      service.createDraft('user1', {
        buyerOrganizationId: 'buyer1',
        requirements: baseRequirements(),
        selectedListingIds: ['lst1'],
      }),
    ).rejects.toThrow(/not published/);
  });

  it('submits DRAFT → SUBMITTED with immutable snapshot + audit', async () => {
    const { service, audits, notifications, prisma } = mockService();
    await service.createDraft('user1', {
      buyerOrganizationId: 'buyer1',
      requirements: baseRequirements(),
      selectedListingIds: ['lst1'],
    });
    const submitted = await service.submit('user1', 'rfq1');
    expect(submitted.status).toBe(RfqStatus.SUBMITTED);
    expect(submitted.submittedAt).toBeTruthy();
    expect(prisma.rfq.update).toHaveBeenCalled();
    expect(audits.some((a) => (a as { action: string }).action === 'RFQ_SUBMITTED')).toBe(
      true,
    );
    expect(
      notifications.some((n) => (n as { type: string }).type === 'RFQ_SUBMITTED'),
    ).toBe(true);
  });

  it('rejects invalid status transition on submit', async () => {
    const { service } = mockService({ rfqStatus: 'SUBMITTED' });
    await expect(service.submit('user1', 'rfq1')).rejects.toThrow(/Cannot submit/);
  });

  it('does not mutate inventory or pricing/margin', async () => {
    const ctx = mockService();
    await ctx.service.createDraft('user1', {
      buyerOrganizationId: 'buyer1',
      requirements: baseRequirements(),
      selectedListingIds: ['lst1'],
    });
    await ctx.service.submit('user1', 'rfq1');
    expect(ctx.getInventoryMutations()).toBe(0);
    expect(ctx.getPriceMutations()).toBe(0);
    expect(ctx.prisma.inventoryBalance.update).not.toHaveBeenCalled();
    expect(ctx.prisma.listingPrice.update).not.toHaveBeenCalled();
  });
});
