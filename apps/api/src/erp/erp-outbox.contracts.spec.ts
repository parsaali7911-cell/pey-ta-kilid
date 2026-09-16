import { ErpOutboxStatus, ErpSyncStatus } from '@prisma/client';
import { ErpOutboxService } from './erp-outbox.service';
import { InMemoryErpProvider } from './provider/memory.provider';
import { NullErpProvider } from './provider/null.provider';
import { toBuyerOrder } from '../commerce/order.mapper';

describe('ErpOutbox processor', () => {
  function buildOrderFixture(overrides?: Record<string, unknown>) {
    return {
      id: 'o1',
      publicId: 'opub',
      quoteId: 'q1',
      rfqId: 'rfq1',
      buyerOrganizationId: 'buyer1',
      sellerOrganizationId: 'seller1',
      currency: 'USD',
      priceType: 'EXW',
      totalDisplayPrice: 1100,
      totalBasePrice: 1000,
      erpExternalId: null as string | null,
      erpSyncStatus: 'PENDING',
      erpSyncError: null as string | null,
      buyerOrganization: {
        id: 'buyer1',
        name: 'Buyer Co',
        slug: 'buyer',
        erpCustomerExternalId: null as string | null,
      },
      sellerOrganization: {
        id: 'seller1',
        name: 'Seller Co',
        slug: 'seller',
        erpSupplierExternalId: null as string | null,
      },
      items: [
        {
          id: 'oi1',
          listingId: 'lst1',
          titleSnapshot: 'Tile',
          quantity: 10,
          displayPrice: 110,
          basePrice: 100,
          uomCode: 'm2',
          sortOrder: 0,
        },
      ],
      ...overrides,
    };
  }

  function mockPrisma(state: {
    events: Record<string, unknown>[];
    order: ReturnType<typeof buildOrderFixture>;
    payment?: Record<string, unknown> | null;
    listing?: Record<string, unknown>;
  }) {
    const orgs = new Map<string, Record<string, unknown>>([
      [state.order.buyerOrganizationId, { ...state.order.buyerOrganization }],
      [state.order.sellerOrganizationId, { ...state.order.sellerOrganization }],
    ]);
    let listing = state.listing ?? {
      id: 'lst1',
      publicId: 'lpub123456789',
      title: 'Tile',
      uomCode: 'm2',
      erpItemExternalId: null as string | null,
    };
    let payment = state.payment ?? null;

    const prisma: Record<string, unknown> = {
      erpOutboxEvent: {
        findUnique: jest.fn(async ({ where }: { where: { id?: string; idempotencyKey?: string } }) => {
          if (where.id) return state.events.find((e) => e.id === where.id) ?? null;
          if (where.idempotencyKey) {
            return state.events.find((e) => e.idempotencyKey === where.idempotencyKey) ?? null;
          }
          return null;
        }),
        findMany: jest.fn(async () => state.events.filter((e) => e.status !== 'DONE')),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: `evt-${state.events.length + 1}`,
            attempts: 0,
            maxAttempts: 5,
            lastError: null,
            externalId: null,
            result: null,
            processedAt: null,
            scheduledAt: new Date(),
            ...data,
          };
          state.events.push(row);
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = state.events.find((e) => e.id === where.id);
          if (!row) return { count: 0 };
          const allowed = ['PENDING', 'RETRYING', 'FAILED'];
          if (!allowed.includes(String(row.status))) return { count: 0 };
          Object.assign(row, {
            status: data.status,
            attempts: Number(row.attempts) + 1,
          });
          return { count: 1 };
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = state.events.find((e) => e.id === where.id)!;
          const next = { ...data };
          if (data.attempts && typeof data.attempts === 'object' && 'decrement' in (data.attempts as object)) {
            next.attempts = Number(row.attempts) - 1;
          }
          Object.assign(row, next);
          return row;
        }),
      },
      order: {
        findUnique: jest.fn(async () => state.order),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(state.order, data);
          return state.order;
        }),
      },
      payment: {
        findUnique: jest.fn(async () => payment),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(payment as object, data);
          return payment;
        }),
      },
      organization: {
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const org = orgs.get(where.id)!;
          Object.assign(org, data);
          if (where.id === state.order.buyerOrganizationId) {
            Object.assign(state.order.buyerOrganization, data);
          }
          if (where.id === state.order.sellerOrganizationId) {
            Object.assign(state.order.sellerOrganization, data);
          }
          return org;
        }),
      },
      listing: {
        findUnique: jest.fn(async () => listing),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          listing = { ...listing, ...data };
          return listing;
        }),
      },
    };

    return { prisma, getPayment: () => payment, setPayment: (p: Record<string, unknown>) => { payment = p; } };
  }

  it('enqueueSafe is idempotent by key', async () => {
    const state = { events: [] as Record<string, unknown>[], order: buildOrderFixture() };
    const { prisma } = mockPrisma(state);
    const service = new ErpOutboxService(prisma as never, new InMemoryErpProvider());
    const a = await service.enqueueSafe({
      jobType: 'SYNC_ORDER',
      entityType: 'Order',
      entityId: 'o1',
      idempotencyKey: 'order:o1',
    });
    const b = await service.enqueueSafe({
      jobType: 'SYNC_ORDER',
      entityType: 'Order',
      entityId: 'o1',
      idempotencyKey: 'order:o1',
    });
    expect(a.id).toBe(b.id);
    expect(state.events).toHaveLength(1);
  });

  it('SYNC_ORDER success stores external IDs; retry does not duplicate', async () => {
    const provider = new InMemoryErpProvider();
    const state = {
      events: [
        {
          id: 'evt1',
          jobType: 'SYNC_ORDER',
          entityType: 'Order',
          entityId: 'o1',
          idempotencyKey: 'order:o1',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 5,
          scheduledAt: new Date(0),
          lastError: null,
          externalId: null,
        },
      ],
      order: buildOrderFixture(),
    };
    const { prisma } = mockPrisma(state);
    const service = new ErpOutboxService(prisma as never, provider);

    const first = await service.processEventById('evt1');
    expect(first?.status).toBe(ErpOutboxStatus.DONE);
    expect(first?.externalId).toMatch(/^SO-/);
    expect(state.order.erpExternalId).toBe(first?.externalId);
    expect(state.order.erpSyncStatus).toBe(ErpSyncStatus.SUCCESS);
    expect(state.order.buyerOrganization.erpCustomerExternalId).toMatch(/^CUST-/);

    // Reset outbox to retry same order — provider returns same SO id
    state.events[0].status = 'PENDING';
    state.events[0].attempts = 0;
    state.order.erpSyncStatus = ErpSyncStatus.SUCCESS; // short-circuit path
    const second = await service.processEventById('evt1');
    expect(second?.externalId).toBe(first?.externalId);

    // Force re-create path with cleared success but same provider map
    state.events[0].status = 'PENDING';
    state.events[0].attempts = 0;
    state.order.erpExternalId = null;
    state.order.erpSyncStatus = ErpSyncStatus.PENDING;
    const third = await service.processEventById('evt1');
    expect(third?.externalId).toBe(first?.externalId);
  });

  it('SYNC_PAYMENT deferred until order synced; then succeeds idempotently', async () => {
    const provider = new InMemoryErpProvider();
    const order = buildOrderFixture({
      erpExternalId: null,
      erpSyncStatus: 'PENDING',
    });
    const payment = {
      id: 'pay1',
      status: 'CONFIRMED',
      amount: 1100,
      currency: 'USD',
      reference: 'ref-1',
      erpExternalId: null,
      erpSyncStatus: 'PENDING',
      order,
    };
    const state = {
      events: [
        {
          id: 'evt-pay',
          jobType: 'SYNC_PAYMENT',
          entityType: 'Payment',
          entityId: 'pay1',
          idempotencyKey: 'payment:pay1',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 5,
          scheduledAt: new Date(0),
          lastError: null,
          externalId: null,
        },
      ],
      order,
      payment,
    };
    const { prisma } = mockPrisma(state);
    const service = new ErpOutboxService(prisma as never, provider);

    const deferred = await service.processEventById('evt-pay');
    expect(deferred?.status).toBe(ErpOutboxStatus.RETRYING);
    expect(String(deferred?.lastError)).toMatch(/Order not synced/);

    order.erpExternalId = 'SO-EXISTING';
    order.erpSyncStatus = ErpSyncStatus.SUCCESS;
    state.events[0].status = 'PENDING';
    state.events[0].attempts = 0;

    const done = await service.processEventById('evt-pay');
    expect(done?.status).toBe(ErpOutboxStatus.DONE);
    expect(payment.erpExternalId).toMatch(/^PE-/);
    expect(payment.erpSyncStatus).toBe(ErpSyncStatus.SUCCESS);

    state.events[0].status = 'PENDING';
    state.events[0].attempts = 0;
    payment.erpSyncStatus = ErpSyncStatus.SUCCESS;
    const again = await service.processEventById('evt-pay');
    expect(again?.externalId).toBe(done?.externalId);
  });

  it('ERP failure leaves retryable outbox; commerce snapshot untouched', async () => {
    const provider = new InMemoryErpProvider();
    provider.setFailNext(true);
    const order = buildOrderFixture();
    const snapshotBase = order.totalBasePrice;
    const state = {
      events: [
        {
          id: 'evt1',
          jobType: 'SYNC_ORDER',
          entityType: 'Order',
          entityId: 'o1',
          idempotencyKey: 'order:o1',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 5,
          scheduledAt: new Date(0),
          lastError: null,
          externalId: null,
        },
      ],
      order,
    };
    const { prisma } = mockPrisma(state);
    const service = new ErpOutboxService(prisma as never, provider);
    const failed = await service.processEventById('evt1');
    expect(failed?.status).toBe(ErpOutboxStatus.RETRYING);
    expect(failed?.lastError).toMatch(/Simulated ERP failure/);
    expect(order.totalBasePrice).toBe(snapshotBase);
    expect(order.erpExternalId).toBeNull();
  });

  it('Null provider keeps outbox retryable without corrupting commerce', async () => {
    const order = buildOrderFixture();
    const state = {
      events: [
        {
          id: 'evt1',
          jobType: 'SYNC_ORDER',
          entityType: 'Order',
          entityId: 'o1',
          idempotencyKey: 'order:o1',
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 5,
          scheduledAt: new Date(0),
          lastError: null,
          externalId: null,
        },
      ],
      order,
    };
    const { prisma } = mockPrisma(state);
    const service = new ErpOutboxService(prisma as never, new NullErpProvider());
    const result = await service.processEventById('evt1');
    expect(result?.status).toBe(ErpOutboxStatus.RETRYING);
    expect(String(result?.lastError)).toMatch(/ERP_NOT_CONFIGURED/);
    expect(order.erpExternalId).toBeNull();
    expect(order.totalDisplayPrice).toBe(1100);
  });

  it('buyer order view never exposes seller cost or ERP internals', () => {
    const row = {
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
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
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
    const buyer = toBuyerOrder(row);
    expect(JSON.stringify(buyer)).not.toMatch(
      /basePrice|totalBasePrice|marginPercent|erpExternal|erpSync|supplierCost/,
    );
  });
});
