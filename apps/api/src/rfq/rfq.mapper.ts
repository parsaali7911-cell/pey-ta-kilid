import {
  Rfq,
  RfqItem,
  RfqStatus,
  RfqTarget,
  StructuredRequirements,
} from '@peytakilid/shared-types';
import { assertNoPrivateLeak } from '../common/contracts/listing-contracts';

export type RfqRow = {
  id: string;
  publicId: string;
  status: string;
  buyerOrganizationId: string;
  createdByUserId: string;
  requirementsSnapshot: unknown;
  buyerNotes: string | null;
  market: string | null;
  locale: string | null;
  budgetMin: unknown;
  budgetMax: unknown;
  budgetCurrency: string | null;
  destinationCountryCode: string | null;
  destinationRegion: string | null;
  destinationProvince: string | null;
  destinationCity: string | null;
  requestedLeadTimeDays: number | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  buyerOrganization: { id: string; name: string; slug: string };
  items: Array<{
    id: string;
    listingId: string | null;
    productId: string | null;
    variantId: string | null;
    categoryId: string | null;
    sellerOrganizationId: string | null;
    titleSnapshot: string | null;
    quantity: unknown;
    uomCode: string;
    attributeFilters: unknown;
    listing?: { publicId: string; slug: string } | null;
    sellerOrganization?: { id: string; name: string; slug: string } | null;
  }>;
  targets: Array<{
    id: string;
    sellerOrganizationId: string;
    listingId: string | null;
    sellerOrganization: { id: string; name: string; slug: string };
  }>;
};

/** Public RFQ DTO — never includes supplierCost/inventory/private address. */
export function toPublicRfq(row: RfqRow): Rfq {
  const items: RfqItem[] = row.items.map((item) => ({
    id: item.id,
    listingId: item.listingId,
    productId: item.productId,
    variantId: item.variantId,
    categoryId: item.categoryId,
    sellerOrganizationId: item.sellerOrganizationId,
    sellerOrganizationPublic: item.sellerOrganization
      ? {
          id: item.sellerOrganization.id,
          name: item.sellerOrganization.name,
          slug: item.sellerOrganization.slug,
        }
      : null,
    listingPublicId: item.listing?.publicId ?? null,
    listingSlug: item.listing?.slug ?? null,
    titleSnapshot: item.titleSnapshot,
    quantity: Number(item.quantity),
    uomCode: item.uomCode,
    attributeFilters:
      (item.attributeFilters as Record<string, string | number | boolean | string[]> | null) ??
      null,
  }));

  const targets: RfqTarget[] = row.targets.map((t) => ({
    id: t.id,
    sellerOrganizationId: t.sellerOrganizationId,
    listingId: t.listingId,
    sellerOrganizationPublic: {
      id: t.sellerOrganization.id,
      name: t.sellerOrganization.name,
      slug: t.sellerOrganization.slug,
    },
  }));

  const rfq: Rfq = {
    id: row.id,
    publicId: row.publicId,
    status: row.status as RfqStatus,
    buyer: {
      userId: row.createdByUserId,
      organizationId: row.buyerOrganization.id,
      organizationName: row.buyerOrganization.name,
      organizationSlug: row.buyerOrganization.slug,
    },
    requirementsSnapshot: row.requirementsSnapshot as StructuredRequirements,
    buyerNotes: row.buyerNotes,
    market: row.market,
    locale: row.locale,
    budget:
      row.budgetMin != null || row.budgetMax != null || row.budgetCurrency
        ? {
            min: row.budgetMin == null ? null : Number(row.budgetMin),
            max: row.budgetMax == null ? null : Number(row.budgetMax),
            currency: row.budgetCurrency,
          }
        : null,
    destination:
      row.destinationCountryCode ||
      row.destinationRegion ||
      row.destinationProvince ||
      row.destinationCity
        ? {
            countryCode: row.destinationCountryCode,
            region: row.destinationRegion,
            province: row.destinationProvince,
            city: row.destinationCity,
          }
        : null,
    requestedLeadTimeDays: row.requestedLeadTimeDays,
    items,
    targets,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  assertNoPrivateLeak(rfq);
  return rfq;
}
