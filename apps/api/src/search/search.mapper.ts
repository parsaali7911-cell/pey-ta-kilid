import {
  SearchHit,
  SearchHitPreview,
  SearchScoreComponent,
} from '@peytakilid/shared-types';
import {
  assertNoPrivateLeak,
  toPublicInventory,
  toPublicPrice,
} from '../common/contracts/listing-contracts';
import { toPublicFacilityLocation } from '../geo/geo.contracts';

export type SearchListingRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  uomCode: string;
  moq: unknown;
  leadTimeDays: number | null;
  category: {
    id: string;
    slug: string;
    nameEn: string;
    nameFa: string | null;
    nameAr: string | null;
  };
  organization: { id: string; name: string; slug: string };
  attributes: Array<{
    attributeDefinition: { code: string };
    valueString: string | null;
    valueNumber: unknown;
    valueBoolean: boolean | null;
  }>;
  price: {
    displayPrice: unknown;
    currency: string;
    priceType: string;
    supplierCost?: unknown;
  } | null;
  inventory: {
    onHand: unknown;
    reserved: unknown;
    uomCode: string;
  } | null;
  facility: {
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
  media?: Array<{ url: string | null; status?: string | null; sortOrder?: number | null }>;
};

/** Build public SearchHit — uses public DTO mappers; never invents values. */
export function toSearchHit(input: {
  listing: SearchListingRow;
  localizedTitle: string;
  localeCategoryName: string;
  score: number;
  matchedAttributes: string[];
  scoreComponents: SearchScoreComponent[];
}): SearchHit {
  const { listing } = input;
  const price = toPublicPrice(listing.price ?? null);
  const inventory = toPublicInventory(listing.inventory ?? null);
  const facility = toPublicFacilityLocation(
    listing.facility
      ? {
          id: listing.facility.id,
          type: listing.facility.type,
          isPublicLocation: listing.facility.isPublicLocation,
          address: {
            countryCode: listing.facility.address.countryCode,
            region: listing.facility.address.region,
            province: listing.facility.address.province,
            city: listing.facility.address.city,
          },
        }
      : null,
  );

  const preview: SearchHitPreview = {
    title: input.localizedTitle,
    slug: listing.slug,
    displayPrice: price?.displayPrice ?? null,
    currency: price?.currency ?? null,
    available: inventory?.available ?? null,
    uomCode: inventory?.uomCode ?? listing.uomCode,
    moq: listing.moq == null ? null : Number(listing.moq),
    leadTimeDays: listing.leadTimeDays,
    imageUrl: firstPublicImageUrl(listing.media),
    category: {
      id: listing.category.id,
      slug: listing.category.slug,
      name: input.localeCategoryName,
    },
    organizationPublic: {
      id: listing.organization.id,
      name: listing.organization.name,
      slug: listing.organization.slug,
    },
    facilityPublic: facility
      ? {
          id: facility.id,
          type: String(facility.type),
          city: facility.city,
          province: facility.province,
          countryCode: facility.countryCode,
        }
      : null,
  };

  const hit: SearchHit = {
    listingId: listing.id,
    score: input.score,
    matchedAttributes: input.matchedAttributes,
    scoreComponents: input.scoreComponents,
    preview,
  };
  assertNoPrivateLeak(hit);
  return hit;
}

export function flattenAttributes(listing: SearchListingRow) {
  return listing.attributes.map((a) => ({
    code: a.attributeDefinition.code,
    valueString: a.valueString,
    valueNumber: a.valueNumber == null ? null : Number(a.valueNumber),
    valueBoolean: a.valueBoolean,
  }));
}

function firstPublicImageUrl(
  media?: Array<{ url: string | null; status?: string | null; sortOrder?: number | null }>,
): string | null {
  if (!media?.length) return null;
  const approved = media
    .filter((m) => m.url && (!m.status || m.status === 'APPROVED'))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return approved[0]?.url || null;
}
