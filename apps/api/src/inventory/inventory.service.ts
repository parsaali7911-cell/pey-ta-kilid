import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryLedgerType, ReservationStatus } from '@prisma/client';
import { availableQuantity, DEFAULT_UOM_FACTORS_TO_BASE } from '@peytakilid/shared-types';
import { AuditService } from '../common/audit.service';
import { toSellerInventory } from '../common/contracts/listing-contracts';
import { NotificationService } from '../common/notification.service';
import { OrgAccessService } from '../common/org-access.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async ensureBalance(listingId: string, uomCode: string) {
    return this.prisma.inventoryBalance.upsert({
      where: { listingId },
      create: { listingId, uomCode, onHand: 0, reserved: 0 },
      update: {},
    });
  }

  async getBalance(listingId: string) {
    const balance = await this.prisma.inventoryBalance.findUnique({ where: { listingId } });
    if (!balance) throw new NotFoundException('Inventory balance not found');
    return this.withAvailable(balance);
  }

  async stockIn(userId: string, listingId: string, quantity: number, note?: string) {
    const result = await this.applyMutation(userId, listingId, InventoryLedgerType.IN, quantity, note);
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (listing) {
      await this.auditInventory(userId, listing.organizationId, listingId, 'inventory.in', {
        quantity,
      });
    }
    return result;
  }

  async stockOut(userId: string, listingId: string, quantity: number, note?: string) {
    const result = await this.applyMutation(userId, listingId, InventoryLedgerType.OUT, quantity, note);
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (listing) {
      await this.auditInventory(userId, listing.organizationId, listingId, 'inventory.out', {
        quantity,
      });
    }
    return result;
  }

  async adjust(userId: string, listingId: string, quantityDelta: number, note?: string) {
    if (quantityDelta === 0) throw new BadRequestException('ADJUST quantity cannot be 0');
    const result = await this.applyMutation(
      userId,
      listingId,
      InventoryLedgerType.ADJUST,
      Math.abs(quantityDelta),
      note,
      quantityDelta,
    );
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (listing) {
      await this.auditInventory(userId, listing.organizationId, listingId, 'inventory.adjust', {
        quantityDelta,
      });
    }
    return result;
  }

  async reserve(
    userId: string,
    listingId: string,
    quantity: number,
    expiresAt?: Date,
  ) {
    if (quantity <= 0) throw new BadRequestException('quantity must be > 0');
    const listing = await this.requireListingWriter(userId, listingId);

    return this.prisma.$transaction(async (tx) => {
      return this.reserveInTx(tx, {
        listingId,
        quantity,
        uomCode: listing.uomCode,
        actorUserId: userId,
        expiresAt,
      });
    }).then(async (result) => {
      await this.auditInventory(userId, listing.organizationId, listingId, 'inventory.reserve', {
        quantity,
        reservationId: result.reservation.id,
      });
      return result;
    });
  }

  /**
   * Marketplace order reservation — idempotent per (orderId, listingId).
   * Does not require seller writer (buyer-driven commercial flow).
   */
  async reserveInTx(
    tx: {
      inventoryBalance: PrismaService['inventoryBalance'];
      inventoryReservation: PrismaService['inventoryReservation'];
      inventoryLedgerEntry: PrismaService['inventoryLedgerEntry'];
    },
    input: {
      listingId: string;
      quantity: number;
      uomCode: string;
      actorUserId?: string | null;
      orderId?: string | null;
      orderItemId?: string | null;
      expiresAt?: Date | null;
    },
  ) {
    if (input.quantity <= 0) throw new BadRequestException('quantity must be > 0');

    if (input.orderId) {
      const existing = await tx.inventoryReservation.findUnique({
        where: {
          orderId_listingId: {
            orderId: input.orderId,
            listingId: input.listingId,
          },
        },
      });
      if (existing && existing.status === ReservationStatus.ACTIVE) {
        const balance = await tx.inventoryBalance.findUnique({
          where: { listingId: input.listingId },
        });
        if (!balance) throw new NotFoundException('Inventory balance not found');
        return { reservation: existing, balance: this.withAvailable(balance), idempotent: true };
      }
    }

    let balance = await tx.inventoryBalance.findUnique({
      where: { listingId: input.listingId },
    });
    if (!balance) {
      balance = await tx.inventoryBalance.create({
        data: {
          listingId: input.listingId,
          uomCode: input.uomCode,
          onHand: 0,
          reserved: 0,
        },
      });
    }

    const avail = availableQuantity(Number(balance.onHand), Number(balance.reserved));
    if (input.quantity > avail) {
      throw new BadRequestException('Insufficient available quantity');
    }

    const reservation = await tx.inventoryReservation.create({
      data: {
        listingId: input.listingId,
        quantity: input.quantity,
        uomCode: input.uomCode,
        status: ReservationStatus.ACTIVE,
        orderId: input.orderId ?? null,
        orderItemId: input.orderItemId ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    });

    const reserved = Number(balance.reserved) + input.quantity;
    const updated = await tx.inventoryBalance.update({
      where: { listingId: input.listingId },
      data: { reserved },
    });

    await tx.inventoryLedgerEntry.create({
      data: {
        listingId: input.listingId,
        type: InventoryLedgerType.RESERVE,
        quantity: input.quantity,
        uomCode: input.uomCode,
        balanceOnHandAfter: updated.onHand,
        balanceReservedAfter: updated.reserved,
        reservationId: reservation.id,
        actorUserId: input.actorUserId ?? null,
        note: input.orderId ? `Order ${input.orderId}` : undefined,
      },
    });

    return { reservation, balance: this.withAvailable(updated), idempotent: false };
  }

  async release(userId: string, reservationId: string) {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    const listing = await this.requireListingWriter(userId, reservation.listingId);
    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException('Reservation is not ACTIVE');
    }

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.inventoryBalance.findUnique({
        where: { listingId: reservation.listingId },
      });
      if (!balance) throw new NotFoundException('Inventory balance not found');

      const reserved = Math.max(0, Number(balance.reserved) - Number(reservation.quantity));
      const updated = await tx.inventoryBalance.update({
        where: { listingId: reservation.listingId },
        data: { reserved },
      });

      const released = await tx.inventoryReservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.RELEASED, releasedAt: new Date() },
      });

      await tx.inventoryLedgerEntry.create({
        data: {
          listingId: reservation.listingId,
          type: InventoryLedgerType.RELEASE,
          quantity: reservation.quantity,
          uomCode: reservation.uomCode,
          balanceOnHandAfter: updated.onHand,
          balanceReservedAfter: updated.reserved,
          reservationId: reservation.id,
          actorUserId: userId,
        },
      });

      return { reservation: released, balance: this.withAvailable(updated) };
    }).then(async (result) => {
      await this.auditInventory(
        userId,
        listing.organizationId,
        reservation.listingId,
        'inventory.release',
        { reservationId },
      );
      return result;
    });
  }

  convertQuantity(quantity: number, fromUom: string, toUom: string, dbFactor?: number | null) {
    if (fromUom === toUom) return quantity;
    if (dbFactor != null) return quantity * dbFactor;
    const from = DEFAULT_UOM_FACTORS_TO_BASE[fromUom];
    const to = DEFAULT_UOM_FACTORS_TO_BASE[toUom];
    if (!from || !to || from.base !== to.base) {
      throw new BadRequestException(`No conversion path ${fromUom} → ${toUom}`);
    }
    return (quantity * from.factor) / to.factor;
  }

  async resolveConversionFactor(fromUom: string, toUom: string) {
    if (fromUom === toUom) return 1;
    const row = await this.prisma.unitConversion.findUnique({
      where: { fromUom_toUom: { fromUom, toUom } },
    });
    if (row?.isActive) return Number(row.factor);
    return null;
  }

  private async applyMutation(
    userId: string,
    listingId: string,
    type: InventoryLedgerType,
    quantity: number,
    note?: string,
    adjustSigned?: number,
  ) {
    if (quantity <= 0) throw new BadRequestException('quantity must be > 0');
    const listing = await this.requireListingWriter(userId, listingId);

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.inventoryBalance.findUnique({ where: { listingId } });
      if (!balance) throw new NotFoundException('Inventory balance not found');

      let onHand = Number(balance.onHand);
      const reserved = Number(balance.reserved);

      if (type === InventoryLedgerType.IN) onHand += quantity;
      else if (type === InventoryLedgerType.OUT) {
        if (quantity > availableQuantity(onHand, reserved)) {
          throw new BadRequestException('Insufficient available quantity');
        }
        onHand -= quantity;
      } else if (type === InventoryLedgerType.ADJUST) {
        const delta = adjustSigned ?? quantity;
        onHand += delta;
        if (onHand < reserved) {
          throw new BadRequestException('ADJUST would make onHand < reserved');
        }
      } else {
        throw new BadRequestException('Unsupported ledger type for mutation');
      }

      const updated = await tx.inventoryBalance.update({
        where: { listingId },
        data: { onHand },
      });

      await tx.inventoryLedgerEntry.create({
        data: {
          listingId,
          type,
          quantity,
          uomCode: listing.uomCode,
          balanceOnHandAfter: updated.onHand,
          balanceReservedAfter: updated.reserved,
          note,
          actorUserId: userId,
        },
      });

      return this.withAvailable(updated);
    });
  }

  private async requireListingWriter(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.orgAccess.requireSellerWriter(userId, listing.organizationId);
    return listing;
  }

  private withAvailable(balance: {
    listingId: string;
    onHand: unknown;
    reserved: unknown;
    uomCode: string;
  }) {
    return {
      listingId: balance.listingId,
      ...toSellerInventory(balance)!,
    };
  }

  private async auditInventory(
    userId: string,
    organizationId: string,
    listingId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.record({
      actorUserId: userId,
      organizationId,
      entityType: 'InventoryBalance',
      entityId: listingId,
      action,
      metadata,
    });
    await this.notifications.enqueue({
      organizationId,
      type: action,
      title: 'Inventory updated',
      payload: { listingId, ...(metadata ?? {}) },
    });
  }
}
