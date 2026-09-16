import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttributeDataType, ListingStatus, LocalizedEntityType, Prisma } from '@prisma/client';
import { resolveLocalizedValue, UOM_CODES } from '@peytakilid/shared-types';
import { TranslationService } from '../ai/translation.service';
import { AuditService } from '../common/audit.service';
import { toPublicListing, toSellerInventory, toSellerPrice } from '../common/contracts/listing-contracts';
import { NotificationService } from '../common/notification.service';
import { OrgAccessService } from '../common/org-access.service';
import { LocalizationService } from '../i18n/localization.service';
import { FacilityService } from '../geo/facility.service';
import { toPublicFacilityLocation, toSellerFacility } from '../geo/geo.contracts';
import { PrismaService } from '../prisma/prisma.service';
import { SeoContentService } from '../seo/seo-content.service';
import { CategoryService } from './category.service';
import {
  AttributeValueInputDto,
  CreateListingDto,
  UpdateListingDto,
} from './dto/listing.dto';

@Injectable()
export class ListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
    private readonly orgAccess: OrgAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly localization: LocalizationService,
    private readonly facilities: FacilityService,
    private readonly translation: TranslationService,
    private readonly seoContent: SeoContentService,
  ) {}

  async create(userId: string, dto: CreateListingDto) {
    await this.orgAccess.requireSellerWriter(userId, dto.organizationId);
    await this.categories.getOrThrow(dto.categoryId);
    this.assertUom(dto.uomCode);
    if (dto.facilityId) {
      await this.facilities.assertFacilityOwnedByOrg(dto.facilityId, dto.organizationId);
    }

    const listing = await this.prisma.listing.create({
      data: {
        organizationId: dto.organizationId,
        categoryId: dto.categoryId,
        slug: dto.slug.toLowerCase(),
        title: dto.title,
        description: dto.description,
        uomCode: dto.uomCode,
        moq: dto.moq,
        leadTimeDays: dto.leadTimeDays,
        productId: dto.productId,
        variantId: dto.variantId,
        facilityId: dto.facilityId,
        status: ListingStatus.DRAFT,
        inventory: {
          create: { uomCode: dto.uomCode, onHand: 0, reserved: 0 },
        },
      },
    });

    if (dto.attributes?.length) {
      await this.replaceListingAttributes(listing.id, listing.categoryId, dto.attributes);
    }

    await this.audit.record({
      actorUserId: userId,
      organizationId: dto.organizationId,
      entityType: 'Listing',
      entityId: listing.id,
      action: 'listing.created',
    });

    await this.localization.upsertContent({
      entityType: LocalizedEntityType.LISTING,
      entityId: listing.id,
      localeCode: 'en',
      field: 'title',
      value: dto.title,
    });
    if (dto.description) {
      await this.localization.upsertContent({
        entityType: LocalizedEntityType.LISTING,
        entityId: listing.id,
        localeCode: 'en',
        field: 'description',
        value: dto.description,
      });
    }

    // Auto SEO at product entry — no manual SEO copy required.
    await this.seoContent.ensureListingSeo(listing.id);

    // Non-blocking translation job — never blocks product save.
    this.translation.scheduleAfterContentChange({
      entityType: 'LISTING',
      entityId: listing.id,
      sourceLocale: 'en',
      organizationId: dto.organizationId,
      actorUserId: userId,
      fields: [
        { field: 'title', sourceText: dto.title },
        { field: 'description', sourceText: dto.description },
        { field: 'seoTitle', sourceText: dto.seoTitle },
        { field: 'seoDescription', sourceText: dto.seoDescription },
      ],
    });

    return this.getById(listing.id);
  }

  async update(userId: string, listingId: string, dto: UpdateListingDto) {
    const listing = await this.getOwnedWritable(userId, listingId);
    const editable =
      listing.status === ListingStatus.DRAFT ||
      listing.status === ListingStatus.REJECTED ||
      listing.status === ListingStatus.APPROVED ||
      listing.status === ListingStatus.PUBLISHED;
    if (!editable) {
      throw new BadRequestException(
        'Only DRAFT, REJECTED, APPROVED, or PUBLISHED listings can be edited',
      );
    }
    if (dto.uomCode) this.assertUom(dto.uomCode);
    if (dto.facilityId) {
      await this.facilities.assertFacilityOwnedByOrg(dto.facilityId, listing.organizationId);
    }

    // Published/approved edits go back to review; draft/rejected stay draft.
    const nextStatus =
      listing.status === ListingStatus.PUBLISHED || listing.status === ListingStatus.APPROVED
        ? ListingStatus.PENDING_REVIEW
        : ListingStatus.DRAFT;

    await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        title: dto.title,
        description: dto.description,
        uomCode: dto.uomCode,
        moq: dto.moq,
        leadTimeDays: dto.leadTimeDays,
        facilityId: dto.facilityId,
        status: nextStatus,
        rejectionReason: null,
        rejectedAt: null,
        ...(nextStatus === ListingStatus.PENDING_REVIEW
          ? { submittedAt: new Date(), publishedAt: null }
          : {}),
      },
    });

    if (dto.attributes) {
      await this.replaceListingAttributes(listingId, listing.categoryId, dto.attributes);
    }

    if (dto.title != null || dto.description != null || dto.seoTitle != null || dto.seoDescription != null) {
      const latest = await this.getByIdRaw(listingId);
      if (dto.title != null) {
        await this.localization.upsertContent({
          entityType: LocalizedEntityType.LISTING,
          entityId: listingId,
          localeCode: 'en',
          field: 'title',
          value: dto.title,
        });
      }
      if (dto.description != null) {
        await this.localization.upsertContent({
          entityType: LocalizedEntityType.LISTING,
          entityId: listingId,
          localeCode: 'en',
          field: 'description',
          value: dto.description,
        });
      }
      this.translation.scheduleAfterContentChange({
        entityType: 'LISTING',
        entityId: listingId,
        sourceLocale: 'en',
        organizationId: listing.organizationId,
        actorUserId: userId,
        fields: [
          { field: 'title', sourceText: dto.title ?? latest.title },
          { field: 'description', sourceText: dto.description ?? latest.description },
          { field: 'seoTitle', sourceText: dto.seoTitle },
          { field: 'seoDescription', sourceText: dto.seoDescription },
        ],
      });
    }

    // Refresh deterministic SEO whenever listing content changes.
    if (
      dto.title != null ||
      dto.description != null ||
      dto.facilityId != null ||
      dto.attributes != null
    ) {
      await this.seoContent.ensureListingSeo(listingId);
    }

    return this.getById(listingId);
  }

  async submit(userId: string, listingId: string) {
    const listing = await this.getOwnedWritable(userId, listingId);
    if (listing.status !== ListingStatus.DRAFT && listing.status !== ListingStatus.REJECTED) {
      throw new BadRequestException('Listing must be DRAFT or REJECTED to submit');
    }
    await this.validateRequiredAttributes(listing.id, listing.categoryId);
    if (!listing.price) {
      throw new BadRequestException('Listing price required before submit');
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.PENDING_REVIEW,
        submittedAt: new Date(),
        rejectionReason: null,
        rejectedAt: null,
      },
      include: this.defaultInclude(),
    });
    await this.audit.record({
      actorUserId: userId,
      organizationId: listing.organizationId,
      entityType: 'Listing',
      entityId: listingId,
      action: 'listing.submitted',
    });
    await this.notifications.enqueue({
      organizationId: listing.organizationId,
      type: 'listing.submitted',
      title: 'Listing submitted for review',
      payload: { listingId },
    });
    await this.seoContent.ensureListingSeo(listingId);
    return this.toSellerListing(updated);
  }

  async approve(listingId: string, actorUserId?: string) {
    const listing = await this.getByIdRaw(listingId);
    if (listing.status !== ListingStatus.PENDING_REVIEW) {
      throw new BadRequestException('Listing must be PENDING_REVIEW');
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.APPROVED },
      include: this.defaultInclude(),
    });
    await this.audit.record({
      actorUserId,
      organizationId: listing.organizationId,
      entityType: 'Listing',
      entityId: listingId,
      action: 'listing.approved',
    });
    return this.toSellerListing(updated);
  }

  async publish(listingId: string, actorUserId?: string) {
    const listing = await this.getByIdRaw(listingId);
    if (
      listing.status !== ListingStatus.APPROVED &&
      listing.status !== ListingStatus.PENDING_REVIEW
    ) {
      throw new BadRequestException('Listing must be APPROVED or PENDING_REVIEW to publish');
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: this.defaultInclude(),
    });
    await this.audit.record({
      actorUserId,
      organizationId: listing.organizationId,
      entityType: 'Listing',
      entityId: listingId,
      action: 'listing.published',
    });
    await this.notifications.enqueue({
      organizationId: listing.organizationId,
      type: 'listing.published',
      title: 'Listing published',
      payload: { listingId },
    });
    // Ensure SEO is present at publish time (covers older drafts).
    await this.seoContent.ensureListingSeo(listingId);
    return this.toSellerListing(updated);
  }

  async reject(listingId: string, reason: string, actorUserId?: string) {
    const listing = await this.getByIdRaw(listingId);
    if (listing.status !== ListingStatus.PENDING_REVIEW) {
      throw new BadRequestException('Listing must be PENDING_REVIEW');
    }
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.REJECTED,
        rejectionReason: reason,
        rejectedAt: new Date(),
      },
      include: this.defaultInclude(),
    });
    await this.audit.record({
      actorUserId,
      organizationId: listing.organizationId,
      entityType: 'Listing',
      entityId: listingId,
      action: 'listing.rejected',
      metadata: { reason },
    });
    await this.notifications.enqueue({
      organizationId: listing.organizationId,
      type: 'listing.rejected',
      title: 'Listing rejected',
      body: reason,
      payload: { listingId },
    });
    return this.toSellerListing(updated);
  }

  listPublished(categoryId?: string, locale?: string) {
    return this.prisma.listing
      .findMany({
        where: {
          status: ListingStatus.PUBLISHED,
          ...(categoryId ? { categoryId } : {}),
        },
        include: this.defaultInclude(),
        orderBy: { publishedAt: 'desc' },
      })
      .then(async (rows) => {
        const resolved = await this.localization.resolveLocale(locale);
        return Promise.all(rows.map((row) => this.toLocalizedPublicListing(row, resolved.code)));
      });
  }

  listForOrg(userId: string, organizationId: string) {
    return this.orgAccess.requireSellerMember(userId, organizationId).then(() =>
      this.prisma.listing
        .findMany({
          where: { organizationId },
          include: this.defaultInclude(),
          orderBy: { updatedAt: 'desc' },
        })
        .then((rows) => rows.map((row) => this.toSellerListing(row))),
    );
  }

  listPendingReview() {
    return this.prisma.listing
      .findMany({
        where: { status: ListingStatus.PENDING_REVIEW },
        include: this.defaultInclude(),
        orderBy: { submittedAt: 'asc' },
      })
      .then((rows) => rows.map((row) => this.toSellerListing(row)));
  }

  async getById(id: string) {
    return this.toSellerListing(await this.getByIdRaw(id));
  }

  async getByIdRaw(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async getPublishedBySlug(slug: string, locale?: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { slug, status: ListingStatus.PUBLISHED },
      include: this.defaultInclude(),
    });
    if (!listing) throw new NotFoundException('Listing not found');
    const resolved = await this.localization.resolveLocale(locale);
    return this.toLocalizedPublicListing(listing, resolved.code);
  }

  private async getOwnedWritable(userId: string, listingId: string) {
    const listing = await this.getByIdRaw(listingId);
    await this.orgAccess.requireSellerWriter(userId, listing.organizationId);
    return listing;
  }

  private assertUom(code: string) {
    if (!(UOM_CODES as readonly string[]).includes(code)) {
      throw new BadRequestException(`Unsupported uomCode: ${code}`);
    }
  }

  private async replaceListingAttributes(
    listingId: string,
    categoryId: string,
    inputs: AttributeValueInputDto[],
  ) {
    const effective = (await this.categories.getEffectiveAttributes(categoryId)) as Array<{
      id: string;
      code: string;
      dataType: AttributeDataType;
      required: boolean;
      enumOptions: unknown;
    }>;
    const byCode = new Map(effective.map((d) => [d.code, d]));

    await this.prisma.attributeValue.deleteMany({ where: { listingId } });

    for (const input of inputs) {
      const def = byCode.get(input.attributeCode);
      if (!def) throw new BadRequestException(`Unknown attribute: ${input.attributeCode}`);
      this.validateAttributeValue(def, input);
      await this.prisma.attributeValue.create({
        data: {
          listingId,
          attributeDefinitionId: def.id,
          valueString: input.valueString,
          valueNumber: input.valueNumber,
          valueBoolean: input.valueBoolean,
          valueJson: input.valueJson as Prisma.InputJsonValue | undefined,
        },
      });
    }
  }

  private async validateRequiredAttributes(listingId: string, categoryId: string) {
    const effective = (await this.categories.getEffectiveAttributes(categoryId)) as Array<{
      id: string;
      code: string;
      required: boolean;
    }>;
    const required = effective.filter((d) => d.required);
    if (!required.length) return;
    const values = await this.prisma.attributeValue.findMany({ where: { listingId } });
    const have = new Set(values.map((v) => v.attributeDefinitionId));
    const missing = required.filter((r) => !have.has(r.id)).map((r) => r.code);
    if (missing.length) {
      throw new BadRequestException(`Missing required attributes: ${missing.join(', ')}`);
    }
  }

  private validateAttributeValue(
    def: { dataType: AttributeDataType; enumOptions: unknown },
    input: AttributeValueInputDto,
  ) {
    switch (def.dataType) {
      case AttributeDataType.STRING:
      case AttributeDataType.ENUM:
        if (!input.valueString) throw new BadRequestException(`${def.dataType} needs valueString`);
        if (def.dataType === AttributeDataType.ENUM) {
          const opts = Array.isArray(def.enumOptions) ? def.enumOptions : [];
          if (opts.length && !opts.includes(input.valueString)) {
            throw new BadRequestException(`Invalid enum value for attribute`);
          }
        }
        break;
      case AttributeDataType.NUMBER:
        if (input.valueNumber == null) throw new BadRequestException('NUMBER needs valueNumber');
        break;
      case AttributeDataType.BOOLEAN:
        if (input.valueBoolean == null) throw new BadRequestException('BOOLEAN needs valueBoolean');
        break;
      case AttributeDataType.RANGE:
        if (input.valueJson == null) throw new BadRequestException('RANGE needs valueJson');
        break;
      default:
        throw new BadRequestException('Unsupported attribute dataType');
    }
  }

  private defaultInclude() {
    return {
      category: true,
      attributes: { include: { attributeDefinition: true } },
      media: true,
      organization: { select: { id: true, name: true, slug: true } },
      price: true,
      inventory: true,
      facility: { include: { address: true, geoPoint: true } },
    } satisfies Prisma.ListingInclude;
  }

  private toSellerListing<T extends {
    price?: {
      displayPrice: unknown;
      currency: string;
      priceType: string;
      supplierCost: unknown;
    } | null;
    inventory?: { onHand: unknown; reserved: unknown; uomCode: string } | null;
    facility?: Parameters<typeof toSellerFacility>[0];
  }>(listing: T) {
    const { price, inventory, facility, ...rest } = listing;
    return {
      ...rest,
      price: toSellerPrice(price ?? null),
      inventory: toSellerInventory(inventory ?? null),
      facility: toSellerFacility(facility ?? null),
    };
  }

  private async toLocalizedPublicListing(
    listing: {
      id: string;
      title: string;
      description: string | null;
      price?: {
        displayPrice: unknown;
        currency: string;
        priceType: string;
        supplierCost?: unknown;
      } | null;
      inventory?: { onHand: unknown; reserved: unknown; uomCode: string } | null;
      facility?: {
        id: string;
        type: string;
        isPublicLocation: boolean;
        address: {
          countryCode: string;
          region: string | null;
          province: string | null;
          city: string;
          line1?: string;
          line2?: string | null;
          postalCode?: string | null;
        };
      } | null;
      [key: string]: unknown;
    },
    locale: string,
  ) {
    const [titleMap, descMap] = await Promise.all([
      this.localization.getFieldMap(LocalizedEntityType.LISTING, listing.id, 'title'),
      this.localization.getFieldMap(LocalizedEntityType.LISTING, listing.id, 'description'),
    ]);
    const { facility, media, ...rest } = listing;
    const publicMedia = Array.isArray(media)
      ? (media as Array<{ status?: string; url?: string | null; sortOrder?: number }>)
          .filter((m) => m && m.url && (m.status === 'APPROVED' || !m.status))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      : [];
    const localized = {
      ...rest,
      media: publicMedia,
      title:
        resolveLocalizedValue({
          locale,
          translations: { ...titleMap, en: titleMap.en || listing.title },
          fallback: listing.title,
        }) || listing.title,
      description: resolveLocalizedValue({
        locale,
        translations: {
          ...descMap,
          en: descMap.en || listing.description,
        },
        fallback: listing.description,
      }),
      locale,
      facility: toPublicFacilityLocation(
        facility
          ? {
              id: facility.id,
              type: facility.type,
              isPublicLocation: facility.isPublicLocation,
              address: {
                countryCode: facility.address.countryCode,
                region: facility.address.region,
                province: facility.address.province,
                city: facility.address.city,
              },
            }
          : null,
      ),
    };
    return toPublicListing(localized as unknown as Record<string, unknown>);
  }
}
