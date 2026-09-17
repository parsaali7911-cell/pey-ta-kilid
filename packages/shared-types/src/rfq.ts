import type { StructuredRequirements } from './intent';

export enum RfqStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  RESPONDED = 'RESPONDED',
  QUOTED = 'QUOTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** Allowed transitions for Phase 0-I (Quote logic later). */
export const RFQ_STATUS_TRANSITIONS: Record<RfqStatus, RfqStatus[]> = {
  [RfqStatus.DRAFT]: [RfqStatus.SUBMITTED, RfqStatus.CANCELLED],
  [RfqStatus.SUBMITTED]: [RfqStatus.RESPONDED, RfqStatus.QUOTED, RfqStatus.CANCELLED],
  [RfqStatus.RESPONDED]: [RfqStatus.QUOTED, RfqStatus.ACCEPTED, RfqStatus.REJECTED, RfqStatus.CANCELLED],
  [RfqStatus.QUOTED]: [RfqStatus.ACCEPTED, RfqStatus.REJECTED, RfqStatus.CANCELLED],
  [RfqStatus.ACCEPTED]: [],
  [RfqStatus.REJECTED]: [],
  [RfqStatus.CANCELLED]: [],
};

export type RfqBudget = {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
};

export type RfqDestination = {
  countryCode?: string | null;
  region?: string | null;
  province?: string | null;
  city?: string | null;
};

/** Requested line — listing/product/variant refs when available. */
export type RfqItemInput = {
  listingId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  categoryId?: string | null;
  quantity: number;
  uomCode: string;
  attributeFilters?: Record<string, string | number | boolean | string[]> | null;
  /** Public title snapshot only — never private pricing */
  titleSnapshot?: string | null;
};

export type RfqItem = RfqItemInput & {
  id: string;
  sellerOrganizationId: string | null;
  sellerOrganizationPublic?: { id: string; name: string; slug: string } | null;
  listingPublicId?: string | null;
  listingSlug?: string | null;
};

/** Seller/listing targeting — extensible for multi-seller RFQs. */
export type RfqTarget = {
  id: string;
  sellerOrganizationId: string;
  listingId: string | null;
  sellerOrganizationPublic?: { id: string; name: string; slug: string } | null;
};

export type RfqBuyerIdentity = {
  userId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

/**
 * Draft contract from Intent/Search — no persistence.
 * RFQ engine consumes StructuredRequirements, not raw chat.
 */
export type RfqDraftFromRequirements = {
  requirements: StructuredRequirements;
  suggestedListingIds: string[];
  buyerNotes?: string | null;
  status: 'draft_contract';
};

export type CreateRfqDraftFromSearchInput = {
  buyerOrganizationId: string;
  requirements: StructuredRequirements;
  /** From SearchHit / RankedRecommendation */
  selectedListingIds: string[];
  buyerNotes?: string | null;
  items?: RfqItemInput[];
  /** Optional My Project workspace context */
  projectId?: string | null;
  projectRequirementId?: string | null;
};

export type Rfq = {
  id: string;
  publicId: string;
  status: RfqStatus;
  buyer: RfqBuyerIdentity;
  requirementsSnapshot: StructuredRequirements;
  buyerNotes: string | null;
  market: string | null;
  locale: string | null;
  budget: RfqBudget | null;
  destination: RfqDestination | null;
  requestedLeadTimeDays: number | null;
  items: RfqItem[];
  targets: RfqTarget[];
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function canTransitionRfqStatus(from: RfqStatus, to: RfqStatus): boolean {
  return RFQ_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function snapshotRequirements(
  requirements: StructuredRequirements,
): StructuredRequirements {
  return JSON.parse(JSON.stringify(requirements)) as StructuredRequirements;
}
