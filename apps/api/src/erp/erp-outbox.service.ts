import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ErpOutboxStatus,
  ErpSyncStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BACKOFF_MS,
  ErpSyncDeferredError,
  erpItemCode,
  erpRecordIdFromResult,
  sanitizeErpError,
} from './erp-sync.helpers';
import {
  ERP_NOT_CONFIGURED,
  ERP_PROVIDER,
  ErpProvider,
} from './provider/erp-provider.interface';

@Injectable()
export class ErpOutboxService {
  private readonly log = new Logger(ErpOutboxService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ERP_PROVIDER) private readonly provider: ErpProvider,
  ) {}

  async enqueueSafe(input: {
    jobType: string;
    entityType: string;
    entityId: string;
    idempotencyKey: string;
    payload?: Record<string, unknown> | null;
  }) {
    const existing = await this.prisma.erpOutboxEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    return this.prisma.erpOutboxEvent.create({
      data: {
        jobType: input.jobType,
        entityType: input.entityType,
        entityId: input.entityId,
        idempotencyKey: input.idempotencyKey,
        status: ErpOutboxStatus.PENDING,
        scheduledAt: new Date(),
        payload:
          input.payload == null
            ? undefined
            : (input.payload as Prisma.InputJsonValue),
      },
    });
  }

  /** Process due PENDING/RETRYING/FAILED (retryable) outbox rows. */
  async pollPending(limit = 20) {
    const now = new Date();
    const jobs = await this.prisma.erpOutboxEvent.findMany({
      where: {
        status: {
          in: [ErpOutboxStatus.PENDING, ErpOutboxStatus.RETRYING, ErpOutboxStatus.FAILED],
        },
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });

    const results = [];
    for (const job of jobs) {
      if (job.status === ErpOutboxStatus.FAILED && job.attempts >= job.maxAttempts) continue;
      results.push(await this.processEventById(job.id));
    }
    return results;
  }

  async processEventById(eventId: string) {
    const job = await this.prisma.erpOutboxEvent.findUnique({ where: { id: eventId } });
    if (!job) return null;
    if (job.status === ErpOutboxStatus.PROCESSING || job.status === ErpOutboxStatus.DONE) {
      return job;
    }

    const claimed = await this.prisma.erpOutboxEvent.updateMany({
      where: {
        id: eventId,
        status: {
          in: [ErpOutboxStatus.PENDING, ErpOutboxStatus.RETRYING, ErpOutboxStatus.FAILED],
        },
      },
      data: {
        status: ErpOutboxStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 0) {
      return this.prisma.erpOutboxEvent.findUnique({ where: { id: eventId } });
    }

    const active = (await this.prisma.erpOutboxEvent.findUnique({ where: { id: eventId } }))!;

    try {
      if (!this.provider.configured) {
        throw new ErpSyncDeferredError(ERP_NOT_CONFIGURED, 15_000);
      }

      const result = await this.executeJob(active.jobType, active.entityId);
      const externalId = erpRecordIdFromResult(result);

      const done = await this.prisma.erpOutboxEvent.update({
        where: { id: eventId },
        data: {
          status: ErpOutboxStatus.DONE,
          processedAt: new Date(),
          externalId,
          lastError: null,
          result: (result ?? undefined) as Prisma.InputJsonValue,
        },
      });

      await this.markEntitySuccess(active.jobType, active.entityId, externalId);
      this.log.log(`ERP ${active.idempotencyKey} done${externalId ? ` → ${externalId}` : ''}`);
      return done;
    } catch (e) {
      return this.handleFailure(active, e);
    }
  }

  private async executeJob(jobType: string, entityId: string) {
    switch (jobType) {
      case 'SYNC_ORDER':
        return this.syncOrder(entityId);
      case 'SYNC_PAYMENT':
        return this.syncPayment(entityId);
      default:
        throw new Error(`Unsupported ERP jobType: ${jobType}`);
    }
  }

  private async syncOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyerOrganization: true,
        sellerOrganization: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!order) throw new Error('Order not found');

    // Idempotent short-circuit — already synced
    if (order.erpExternalId && order.erpSyncStatus === ErpSyncStatus.SUCCESS) {
      return { externalId: order.erpExternalId };
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { erpSyncStatus: ErpSyncStatus.SYNCING, erpSyncError: null },
    });

    const customer = await this.provider.upsertCustomer({
      peytakilidId: order.buyerOrganizationId,
      customerName: order.buyerOrganization.name,
      currency: order.currency,
    });
    if (!order.buyerOrganization.erpCustomerExternalId) {
      await this.prisma.organization.update({
        where: { id: order.buyerOrganizationId },
        data: { erpCustomerExternalId: customer.externalId },
      });
    }

    await this.provider.upsertSupplier({
      peytakilidId: order.sellerOrganizationId,
      supplierName: order.sellerOrganization.name,
      currency: order.currency,
    }).then(async (supplier) => {
      if (!order.sellerOrganization.erpSupplierExternalId) {
        await this.prisma.organization.update({
          where: { id: order.sellerOrganizationId },
          data: { erpSupplierExternalId: supplier.externalId },
        });
      }
    });

    const lineItems: Array<{ itemCode: string; qty: number; rate: number }> = [];
    for (const item of order.items) {
      const listingId = item.listingId;
      let itemCode = listingId
        ? (
            await this.prisma.listing.findUnique({
              where: { id: listingId },
              select: { id: true, publicId: true, erpItemExternalId: true, title: true, uomCode: true },
            })
          )
        : null;

      if (listingId && itemCode) {
        if (!itemCode.erpItemExternalId) {
          const upserted = await this.provider.upsertItem({
            peytakilidId: listingId,
            itemName: item.titleSnapshot || itemCode.title,
            itemCode: erpItemCode(itemCode.publicId),
            stockUom: item.uomCode || itemCode.uomCode,
          });
          await this.prisma.listing.update({
            where: { id: listingId },
            data: { erpItemExternalId: upserted.externalId },
          });
          itemCode = { ...itemCode, erpItemExternalId: upserted.externalId };
        }
        lineItems.push({
          itemCode: itemCode.erpItemExternalId!,
          qty: Number(item.quantity),
          // Buyer display rate only — never basePrice
          rate: Number(item.displayPrice),
        });
      } else {
        const code = erpItemCode(item.id);
        const upserted = await this.provider.upsertItem({
          peytakilidId: item.id,
          itemName: item.titleSnapshot || `Item ${item.id.slice(0, 6)}`,
          itemCode: code,
          stockUom: item.uomCode,
        });
        lineItems.push({
          itemCode: upserted.externalId,
          qty: Number(item.quantity),
          rate: Number(item.displayPrice),
        });
      }
    }

    const result = await this.provider.createSalesOrder({
      peytakilidOrderId: order.id,
      customerExternalId: customer.externalId,
      currency: order.currency,
      items: lineItems,
    });

    return result;
  }

  private async syncPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: { buyerOrganization: true },
        },
      },
    });
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== PaymentStatus.CONFIRMED) {
      throw new Error('Payment not confirmed');
    }

    if (payment.erpExternalId && payment.erpSyncStatus === ErpSyncStatus.SUCCESS) {
      return { externalId: payment.erpExternalId };
    }

    if (!payment.order.erpExternalId) {
      throw new ErpSyncDeferredError('Order not synced to ERP', 5_000);
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { erpSyncStatus: ErpSyncStatus.SYNCING, erpSyncError: null },
    });

    let customerExternalId = payment.order.buyerOrganization.erpCustomerExternalId;
    if (!customerExternalId) {
      const customer = await this.provider.upsertCustomer({
        peytakilidId: payment.order.buyerOrganizationId,
        customerName: payment.order.buyerOrganization.name,
        currency: payment.currency,
      });
      customerExternalId = customer.externalId;
      await this.prisma.organization.update({
        where: { id: payment.order.buyerOrganizationId },
        data: { erpCustomerExternalId: customerExternalId },
      });
    }

    return this.provider.createPaymentEntry({
      peytakilidPaymentId: payment.id,
      partyType: 'Customer',
      partyExternalId: customerExternalId,
      amount: Number(payment.amount),
      currency: payment.currency,
      referenceNo: payment.reference ?? undefined,
      againstOrderExternalId: payment.order.erpExternalId,
    });
  }

  private async markEntitySuccess(jobType: string, entityId: string, externalId: string | null) {
    const data = {
      erpExternalId: externalId,
      erpSyncStatus: ErpSyncStatus.SUCCESS,
      erpLastSyncedAt: new Date(),
      erpSyncError: null,
    };
    if (jobType === 'SYNC_ORDER') {
      await this.prisma.order.update({ where: { id: entityId }, data });
    } else if (jobType === 'SYNC_PAYMENT') {
      await this.prisma.payment.update({ where: { id: entityId }, data });
    }
  }

  private async markEntityRetrying(jobType: string, entityId: string, error: string, failed: boolean) {
    const data = {
      erpSyncStatus: failed ? ErpSyncStatus.FAILED : ErpSyncStatus.RETRYING,
      erpSyncError: error,
    };
    if (jobType === 'SYNC_ORDER') {
      await this.prisma.order.update({ where: { id: entityId }, data }).catch(() => undefined);
    } else if (jobType === 'SYNC_PAYMENT') {
      await this.prisma.payment.update({ where: { id: entityId }, data }).catch(() => undefined);
    }
  }

  private async handleFailure(
    job: {
      id: string;
      jobType: string;
      entityId: string;
      idempotencyKey: string;
      attempts: number;
      maxAttempts: number;
      scheduledAt: Date;
    },
    e: unknown,
  ) {
    if (e instanceof ErpSyncDeferredError || (e instanceof Error && e.message === ERP_NOT_CONFIGURED)) {
      const message = sanitizeErpError(e instanceof Error ? e.message : String(e));
      const retryAfter =
        e instanceof ErpSyncDeferredError ? e.retryAfterMs : 15_000;
      const updated = await this.prisma.erpOutboxEvent.update({
        where: { id: job.id },
        data: {
          status: ErpOutboxStatus.RETRYING,
          attempts: { decrement: 1 },
          lastError: message,
          scheduledAt: new Date(Date.now() + retryAfter),
        },
      });
      await this.markEntityRetrying(job.jobType, job.entityId, message, false);
      this.log.warn(`ERP ${job.idempotencyKey} deferred: ${message}`);
      return updated;
    }

    const message = sanitizeErpError(e instanceof Error ? e.message : String(e));
    const failed = job.attempts >= job.maxAttempts;
    const backoff = BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)]!;

    const updated = await this.prisma.erpOutboxEvent.update({
      where: { id: job.id },
      data: {
        status: failed ? ErpOutboxStatus.FAILED : ErpOutboxStatus.RETRYING,
        lastError: message,
        scheduledAt: failed ? job.scheduledAt : new Date(Date.now() + backoff),
      },
    });
    await this.markEntityRetrying(job.jobType, job.entityId, message, failed);
    this.log.warn(`ERP ${job.idempotencyKey} attempt ${job.attempts}: ${message}`);
    return updated;
  }
}
