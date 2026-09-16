import {
  QuoteAdminView,
  QuoteBuyerView,
  QuoteSellerView,
  QuoteStatus,
} from '@peytakilid/shared-types';
import { assertNoPrivateLeak } from '../common/contracts/listing-contracts';

export type QuoteRow = {
  id: string;
  publicId: string;
  status: string;
  rfqId: string;
  sellerOrganizationId: string;
  createdByUserId: string;
  currency: string;
  priceType: string;
  validUntil: Date | null;
  sellerNotes: string | null;
  totalDisplayPrice: unknown;
  totalBasePrice: unknown;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sellerOrganization: { id: string; name: string; slug: string };
  rfq: { buyerOrganizationId: string };
  items: Array<{
    id: string;
    rfqItemId: string | null;
    listingId: string | null;
    productId: string | null;
    variantId: string | null;
    quantity: unknown;
    uomCode: string;
    basePrice: unknown;
    displayPrice: unknown;
    currency: string;
    priceType: string;
    fxRateApplied: unknown;
    marginPercentApplied: unknown;
    flatFeeApplied: unknown;
    leadTimeDays: number | null;
    titleSnapshot: string | null;
  }>;
};

function baseView(row: QuoteRow) {
  return {
    id: row.id,
    publicId: row.publicId,
    status: row.status as QuoteStatus,
    rfqId: row.rfqId,
    seller: {
      id: row.sellerOrganization.id,
      name: row.sellerOrganization.name,
      slug: row.sellerOrganization.slug,
    },
    buyerOrganizationId: row.rfq.buyerOrganizationId,
    currency: row.currency,
    priceType: row.priceType,
    validUntil: row.validUntil?.toISOString() ?? null,
    sellerNotes: row.sellerNotes,
    totalDisplayPrice: Number(row.totalDisplayPrice ?? 0),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Buyer view — never includes basePrice / margin internals. */
export function toBuyerQuote(row: QuoteRow): QuoteBuyerView {
  const quote: QuoteBuyerView = {
    ...baseView(row),
    items: row.items.map((item) => ({
      id: item.id,
      rfqItemId: item.rfqItemId,
      listingId: item.listingId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: Number(item.quantity),
      uomCode: item.uomCode,
      displayPrice: Number(item.displayPrice),
      currency: item.currency,
      priceType: item.priceType,
      leadTimeDays: item.leadTimeDays,
      titleSnapshot: item.titleSnapshot,
    })),
  };
  assertNoPrivateLeak(quote);
  return quote;
}

/** Seller view — own base price + buyer display; no admin-only rule dump beyond totals. */
export function toSellerQuote(row: QuoteRow): QuoteSellerView {
  const quote: QuoteSellerView = {
    ...baseView(row),
    totalBasePrice: Number(row.totalBasePrice ?? 0),
    items: row.items.map((item) => ({
      id: item.id,
      rfqItemId: item.rfqItemId,
      listingId: item.listingId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: Number(item.quantity),
      uomCode: item.uomCode,
      basePrice: Number(item.basePrice),
      displayPrice: Number(item.displayPrice),
      currency: item.currency,
      priceType: item.priceType,
      leadTimeDays: item.leadTimeDays,
      titleSnapshot: item.titleSnapshot,
    })),
  };
  // Seller may see basePrice; still block other private inventory/address keys.
  const json = JSON.stringify(quote);
  for (const key of ['onHand', 'reserved', 'line1', 'passwordHash'] as const) {
    if (json.includes(`"${key}"`)) throw new Error(`Seller quote leak detected: ${key}`);
  }
  return quote;
}

export function toAdminQuote(row: QuoteRow): QuoteAdminView {
  const seller = toSellerQuote(row);
  return {
    ...seller,
    items: row.items.map((item) => ({
      id: item.id,
      rfqItemId: item.rfqItemId,
      listingId: item.listingId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: Number(item.quantity),
      uomCode: item.uomCode,
      basePrice: Number(item.basePrice),
      displayPrice: Number(item.displayPrice),
      currency: item.currency,
      priceType: item.priceType,
      fxRateApplied: Number(item.fxRateApplied ?? 1),
      marginPercentApplied: Number(item.marginPercentApplied ?? 0),
      flatFeeApplied: Number(item.flatFeeApplied ?? 0),
      leadTimeDays: item.leadTimeDays,
      titleSnapshot: item.titleSnapshot,
    })),
    pricingSnapshots: row.items.map((item) => ({
      basePrice: Number(item.basePrice),
      displayPrice: Number(item.displayPrice),
      currency: item.currency,
      priceType: item.priceType,
      fxRateApplied: Number(item.fxRateApplied ?? 1),
      marginPercentApplied: Number(item.marginPercentApplied ?? 0),
      flatFeeApplied: Number(item.flatFeeApplied ?? 0),
    })),
  };
}
