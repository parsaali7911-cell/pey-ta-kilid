export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.DRAFT]: [QuoteStatus.SUBMITTED, QuoteStatus.CANCELLED],
  [QuoteStatus.SUBMITTED]: [
    QuoteStatus.ACCEPTED,
    QuoteStatus.REJECTED,
    QuoteStatus.EXPIRED,
    QuoteStatus.CANCELLED,
  ],
  [QuoteStatus.ACCEPTED]: [],
  [QuoteStatus.REJECTED]: [],
  [QuoteStatus.EXPIRED]: [],
  [QuoteStatus.CANCELLED]: [],
};

export function canTransitionQuoteStatus(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export type QuoteOrgPublic = {
  id: string;
  name: string;
  slug: string;
};

/** Immutable marketplace pricing snapshot at quote time. */
export type QuotePricingSnapshot = {
  basePrice: number;
  displayPrice: number;
  currency: string;
  priceType: string;
  fxRateApplied: number;
  marginPercentApplied: number;
  flatFeeApplied: number;
};

export type QuoteItemInput = {
  rfqItemId?: string | null;
  listingId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  quantity: number;
  uomCode: string;
  /** Seller/base price entered by seller — maps to PricingEngine supplierCost input */
  basePrice: number;
  leadTimeDays?: number | null;
  titleSnapshot?: string | null;
};

export type QuoteItemBuyerView = {
  id: string;
  rfqItemId: string | null;
  listingId: string | null;
  productId: string | null;
  variantId: string | null;
  quantity: number;
  uomCode: string;
  displayPrice: number;
  currency: string;
  priceType: string;
  leadTimeDays: number | null;
  titleSnapshot: string | null;
};

export type QuoteItemSellerView = QuoteItemBuyerView & {
  basePrice: number;
};

export type QuoteItemAdminView = QuoteItemSellerView & {
  fxRateApplied: number;
  marginPercentApplied: number;
  flatFeeApplied: number;
};

export type CreateQuoteDraftInput = {
  sellerOrganizationId: string;
  rfqId: string;
  rfqTargetId?: string | null;
  currency: string;
  priceType: string;
  validUntil?: string | null;
  sellerNotes?: string | null;
  items: QuoteItemInput[];
};

export type QuoteBuyerView = {
  id: string;
  publicId: string;
  status: QuoteStatus;
  rfqId: string;
  seller: QuoteOrgPublic;
  buyerOrganizationId: string;
  currency: string;
  priceType: string;
  validUntil: string | null;
  sellerNotes: string | null;
  totalDisplayPrice: number;
  items: QuoteItemBuyerView[];
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteSellerView = Omit<QuoteBuyerView, 'items'> & {
  items: QuoteItemSellerView[];
  totalBasePrice: number;
};

export type QuoteAdminView = Omit<QuoteSellerView, 'items'> & {
  items: QuoteItemAdminView[];
  pricingSnapshots: QuotePricingSnapshot[];
};
