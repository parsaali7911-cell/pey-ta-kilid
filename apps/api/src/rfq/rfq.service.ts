import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, Prisma, RfqStatus } from '@prisma/client';
import {
  canTransitionRfqStatus,
  CreateRfqDraftFromSearchInput,
  RfqDraftFromRequirements,
  RfqStatus as SharedRfqStatus,
  snapshotRequirements,
  StructuredRequirements,
  UOM_CODES,
} from '@peytakilid/shared-types';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';
import { OrgAccessService } from '../common/org-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicRfq } from './rfq.mapper';

const RFQ_INCLUDE = {
  buyerOrganization: { select: { id: true, name: true, slug: true } },
  items: {
    include: {
      listing: { select: { publicId: true, slug: true } },
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  targets: {
    include: {
      sellerOrganization: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.RfqInclude;

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  /** Intent contract → draft shape (no persistence). */
  draftFromRequirements(
    requirements: StructuredRequirements,
    suggestedListingIds: string[] = [],
    buyerNotes?: string | null,
  ): RfqDraftFromRequirements {
    return {
      requirements: snapshotRequirements(requirements),
      suggestedListingIds: [...suggestedListingIds],
      buyerNotes: buyerNotes ?? null,
      status: 'draft_contract',
    };
  }

  async createDraft(userId: string, input: CreateRfqDraftFromSearchInput) {
    await this.orgAccess.requireBuyerWriter(userId, input.buyerOrganizationId);
    this.assertRequirements(input.requirements);

    const fromItems = (input.items ?? [])
      .map((i) => i.listingId)
      .filter((id): id is string => Boolean(id));
    const listingIds = [...new Set([...(input.selectedListingIds ?? []), ...fromItems])];

    const listings = listingIds.length
      ? await this.prisma.listing.findMany({
          where: { id: { in: listingIds } },
          select: {
            id: true,
            publicId: true,
            slug: true,
            title: true,
            organizationId: true,
            categoryId: true,
            productId: true,
            variantId: true,
            uomCode: true,
            status: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        })
      : [];

    if (listingIds.length && listings.length !== listingIds.length) {
      throw new BadRequestException('Invalid listing reference');
    }
    for (const listing of listings) {
      if (listing.status !== ListingStatus.PUBLISHED) {
        throw new BadRequestException(`Listing not published: ${listing.id}`);
      }
    }
    const listingById = new Map(listings.map((l) => [l.id, l]));

    const itemsInput =
      input.items?.length
        ? input.items
        : listings.map((l) => ({
            listingId: l.id,
            productId: l.productId,
            variantId: l.variantId,
            categoryId: l.categoryId,
            quantity: input.requirements.quantity ?? 1,
            uomCode: input.requirements.uomCode ?? l.uomCode,
            attributeFilters: input.requirements.attributeFilters,
            titleSnapshot: l.title,
          }));

    if (!itemsInput.length) {
      throw new BadRequestException('RFQ requires at least one item or listing');
    }

    for (const item of itemsInput) {
      if (!(UOM_CODES as readonly string[]).includes(item.uomCode)) {
        throw new BadRequestException(`Unsupported uomCode: ${item.uomCode}`);
      }
      if (!(item.quantity > 0)) {
        throw new BadRequestException('quantity must be > 0');
      }
      if (item.listingId && !listingById.has(item.listingId)) {
        throw new BadRequestException(`Invalid listing reference: ${item.listingId}`);
      }
    }

    const snapshot = snapshotRequirements(input.requirements);
    const budget = snapshot.budget;
    const destination = snapshot.location;

    const rfq = await this.prisma.rfq.create({
      data: {
        buyerOrganizationId: input.buyerOrganizationId,
        createdByUserId: userId,
        status: RfqStatus.DRAFT,
        requirementsSnapshot: snapshot as Prisma.InputJsonValue,
        buyerNotes: input.buyerNotes ?? null,
        market: snapshot.market ?? null,
        locale: snapshot.locale ?? null,
        budgetMin: budget?.min ?? null,
        budgetMax: budget?.max ?? null,
        budgetCurrency: budget?.currency ?? null,
        destinationCountryCode: destination?.countryCode ?? null,
        destinationRegion: destination?.region ?? null,
        destinationProvince: destination?.province ?? null,
        destinationCity: destination?.city ?? null,
        projectId: input.projectId || null,
        projectRequirementId: input.projectRequirementId || null,
        items: {
          create: itemsInput.map((item, idx) => {
            const listing = item.listingId ? listingById.get(item.listingId) : null;
            return {
              listingId: item.listingId ?? null,
              productId: item.productId ?? listing?.productId ?? null,
              variantId: item.variantId ?? listing?.variantId ?? null,
              categoryId: item.categoryId ?? listing?.categoryId ?? null,
              sellerOrganizationId: listing?.organizationId ?? null,
              titleSnapshot: item.titleSnapshot ?? listing?.title ?? null,
              quantity: item.quantity,
              uomCode: item.uomCode,
              attributeFilters:
                (item.attributeFilters ?? null) as Prisma.InputJsonValue,
              sortOrder: idx,
            };
          }),
        },
        targets: {
          create: listings.map((l) => ({
            sellerOrganizationId: l.organizationId,
            listingId: l.id,
          })),
        },
      },
      include: RFQ_INCLUDE,
    });

    if (input.projectRequirementId) {
      await this.prisma.projectRequirement
        .update({
          where: { id: input.projectRequirementId },
          data: {
            rfqId: rfq.id,
            status: 'RFQ_OPEN',
            listingId: listingIds[0] || undefined,
          },
        })
        .catch(() => null);
    }
    // Attach seller org public info onto items for mapper (not in include path easily)
    const enriched = await this.getByIdRaw(rfq.id);

    await this.audit.record({
      actorUserId: userId,
      organizationId: input.buyerOrganizationId,
      entityType: 'Rfq',
      entityId: rfq.id,
      action: 'RFQ_CREATED',
      metadata: { status: RfqStatus.DRAFT, listingIds },
    });
    await this.notifications.enqueue({
      userId,
      organizationId: input.buyerOrganizationId,
      type: 'RFQ_CREATED',
      title: 'RFQ created',
      payload: { rfqId: rfq.id },
    });

    return toPublicRfq(enriched);
  }

  async submit(userId: string, rfqId: string) {
    const rfq = await this.getByIdRaw(rfqId);
    await this.orgAccess.requireBuyerWriter(userId, rfq.buyerOrganizationId);

    if (
      !canTransitionRfqStatus(
        rfq.status as SharedRfqStatus,
        SharedRfqStatus.SUBMITTED,
      )
    ) {
      throw new BadRequestException(`Cannot submit RFQ from status ${rfq.status}`);
    }
    if (!rfq.items.length) {
      throw new BadRequestException('RFQ has no items');
    }

    // Freeze snapshot again at submit so later edits cannot rewrite intent.
    const frozen = snapshotRequirements(
      rfq.requirementsSnapshot as StructuredRequirements,
    );

    const updated = await this.prisma.rfq.update({
      where: { id: rfqId },
      data: {
        status: RfqStatus.SUBMITTED,
        requirementsSnapshot: frozen as Prisma.InputJsonValue,
        submittedAt: new Date(),
      },
      include: RFQ_INCLUDE,
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: rfq.buyerOrganizationId,
      entityType: 'Rfq',
      entityId: rfqId,
      action: 'RFQ_SUBMITTED',
      metadata: { previousStatus: rfq.status },
    });
    await this.notifications.enqueue({
      userId,
      organizationId: rfq.buyerOrganizationId,
      type: 'RFQ_SUBMITTED',
      title: 'RFQ submitted',
      payload: { rfqId },
    });

    return toPublicRfq(await this.enrichItems(updated));
  }

  async listForBuyer(userId: string, buyerOrganizationId: string) {
    await this.orgAccess.requireBuyerMember(userId, buyerOrganizationId);
    const rows = await this.prisma.rfq.findMany({
      where: { buyerOrganizationId },
      include: RFQ_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(rows.map((r) => this.enrichItems(r).then(toPublicRfq)));
  }

  async getAuthorized(userId: string, rfqId: string) {
    const rfq = await this.getByIdRaw(rfqId);
    await this.orgAccess.requireBuyerMember(userId, rfq.buyerOrganizationId);
    return toPublicRfq(rfq);
  }

  private async getByIdRaw(id: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      include: RFQ_INCLUDE,
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return this.enrichItems(rfq);
  }

  private async enrichItems<
    T extends {
      items: Array<{ sellerOrganizationId: string | null; [k: string]: unknown }>;
    },
  >(rfq: T) {
    const sellerIds = [
      ...new Set(
        rfq.items
          .map((i) => i.sellerOrganizationId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const orgs = sellerIds.length
      ? await this.prisma.organization.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const byId = new Map(orgs.map((o) => [o.id, o]));
    return {
      ...rfq,
      items: rfq.items.map((item) => ({
        ...item,
        sellerOrganization: item.sellerOrganizationId
          ? byId.get(item.sellerOrganizationId) ?? null
          : null,
      })),
    };
  }

  private assertRequirements(requirements: StructuredRequirements) {
    if (!requirements || typeof requirements !== 'object') {
      throw new BadRequestException('requirements required');
    }
    if (!requirements.intent) {
      throw new BadRequestException('requirements.intent required');
    }
  }
}
