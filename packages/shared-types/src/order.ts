export enum OrderStatus {
  CONFIRMED = 'CONFIRMED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  MANUAL = 'MANUAL',
  OTHER = 'OTHER',
}

export enum PaymentTermsCode {
  ADVANCE_100 = '100_ADVANCE',
  SPLIT_50_50 = '50_50',
  SPLIT_30_40_30 = '30_40_30',
}

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CONFIRMED]: [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
  [OrderStatus.AWAITING_PAYMENT]: [
    OrderStatus.PARTIALLY_PAID,
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PARTIALLY_PAID]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export type OrderOrgPublic = {
  id: string;
  name: string;
  slug: string;
};

/** Immutable commercial line snapshot copied from accepted QuoteItem. */
export type OrderItemBuyerView = {
  id: string;
  quoteItemId: string | null;
  listingId: string | null;
  productId: string | null;
  variantId: string | null;
  facilityId: string | null;
  quantity: number;
  uomCode: string;
  displayPrice: number;
  currency: string;
  priceType: string;
  leadTimeDays: number | null;
  titleSnapshot: string | null;
  lineDisplayTotal: number;
};

export type OrderItemSellerView = OrderItemBuyerView & {
  basePrice: number;
  lineBaseTotal: number;
};

export type OrderItemAdminView = OrderItemSellerView & {
  fxRateApplied: number;
  marginPercentApplied: number;
  flatFeeApplied: number;
};

export type OrderBuyerView = {
  id: string;
  publicId: string;
  status: OrderStatus;
  rfqId: string;
  quoteId: string;
  buyer: OrderOrgPublic;
  seller: OrderOrgPublic;
  currency: string;
  priceType: string;
  totalDisplayPrice: number;
  items: OrderItemBuyerView[];
  /** Latest payments on the order (buyer-safe; no secrets). */
  payments?: PaymentBuyerView[];
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderSellerView = Omit<OrderBuyerView, 'items'> & {
  items: OrderItemSellerView[];
  totalBasePrice: number;
};

export type OrderAdminView = Omit<OrderSellerView, 'items'> & {
  items: OrderItemAdminView[];
};

export type PaymentBuyerView = {
  id: string;
  publicId: string;
  orderId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  currency: string;
  reference: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
};

export type SubmitPaymentInput = {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  idempotencyKey: string;
  reference?: string | null;
};
