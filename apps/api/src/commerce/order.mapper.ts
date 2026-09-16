import {
  OrderAdminView,
  OrderBuyerView,
  OrderSellerView,
  OrderStatus,
  PaymentBuyerView,
  PaymentStatus,
} from '@peytakilid/shared-types';
import { assertNoPrivateLeak } from '../common/contracts/listing-contracts';

export type OrderRow = {
  id: string;
  publicId: string;
  status: string;
  rfqId: string;
  quoteId: string;
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  currency: string;
  priceType: string;
  totalDisplayPrice: unknown;
  totalBasePrice: unknown;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  buyerOrganization: { id: string; name: string; slug: string };
  sellerOrganization: { id: string; name: string; slug: string };
  items: Array<{
    id: string;
    quoteItemId: string | null;
    listingId: string | null;
    productId: string | null;
    variantId: string | null;
    facilityId: string | null;
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
    lineDisplayTotal: unknown;
    lineBaseTotal: unknown;
  }>;
  payments?: Array<{
    id: string;
    publicId: string;
    orderId: string;
    status: string;
    method: string;
    amount: unknown;
    currency: string;
    reference: string | null;
    submittedAt: Date | null;
    confirmedAt: Date | null;
  }>;
};

function baseView(row: OrderRow) {
  return {
    id: row.id,
    publicId: row.publicId,
    status: row.status as OrderStatus,
    rfqId: row.rfqId,
    quoteId: row.quoteId,
    buyer: {
      id: row.buyerOrganization.id,
      name: row.buyerOrganization.name,
      slug: row.buyerOrganization.slug,
    },
    seller: {
      id: row.sellerOrganization.id,
      name: row.sellerOrganization.name,
      slug: row.sellerOrganization.slug,
    },
    currency: row.currency,
    priceType: row.priceType,
    totalDisplayPrice: Number(row.totalDisplayPrice),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toBuyerOrder(row: OrderRow): OrderBuyerView {
  const order: OrderBuyerView = {
    ...baseView(row),
    items: row.items.map((item) => ({
      id: item.id,
      quoteItemId: item.quoteItemId,
      listingId: item.listingId,
      productId: item.productId,
      variantId: item.variantId,
      facilityId: item.facilityId,
      quantity: Number(item.quantity),
      uomCode: item.uomCode,
      displayPrice: Number(item.displayPrice),
      currency: item.currency,
      priceType: item.priceType,
      leadTimeDays: item.leadTimeDays,
      titleSnapshot: item.titleSnapshot,
      lineDisplayTotal: Number(item.lineDisplayTotal),
    })),
    payments: (row.payments ?? []).map((p) => toBuyerPayment(p)),
  };
  assertNoPrivateLeak(order);
  return order;
}

export function toSellerOrder(row: OrderRow): OrderSellerView {
  const order: OrderSellerView = {
    ...baseView(row),
    totalBasePrice: Number(row.totalBasePrice),
    items: row.items.map((item) => ({
      id: item.id,
      quoteItemId: item.quoteItemId,
      listingId: item.listingId,
      productId: item.productId,
      variantId: item.variantId,
      facilityId: item.facilityId,
      quantity: Number(item.quantity),
      uomCode: item.uomCode,
      basePrice: Number(item.basePrice),
      displayPrice: Number(item.displayPrice),
      currency: item.currency,
      priceType: item.priceType,
      leadTimeDays: item.leadTimeDays,
      titleSnapshot: item.titleSnapshot,
      lineDisplayTotal: Number(item.lineDisplayTotal),
      lineBaseTotal: Number(item.lineBaseTotal),
    })),
  };
  const json = JSON.stringify(order);
  for (const key of ['onHand', 'reserved', 'passwordHash'] as const) {
    if (json.includes(`"${key}"`)) throw new Error(`Seller order leak detected: ${key}`);
  }
  return order;
}

export function toAdminOrder(row: OrderRow): OrderAdminView {
  const seller = toSellerOrder(row);
  return {
    ...seller,
    items: row.items.map((item) => ({
      id: item.id,
      quoteItemId: item.quoteItemId,
      listingId: item.listingId,
      productId: item.productId,
      variantId: item.variantId,
      facilityId: item.facilityId,
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
      lineDisplayTotal: Number(item.lineDisplayTotal),
      lineBaseTotal: Number(item.lineBaseTotal),
    })),
  };
}

export function toBuyerPayment(row: {
  id: string;
  publicId: string;
  orderId: string;
  status: string;
  method: string;
  amount: unknown;
  currency: string;
  reference: string | null;
  submittedAt: Date | null;
  confirmedAt: Date | null;
}): PaymentBuyerView {
  return {
    id: row.id,
    publicId: row.publicId,
    orderId: row.orderId,
    status: row.status as PaymentStatus,
    method: row.method as PaymentBuyerView['method'],
    amount: Number(row.amount),
    currency: row.currency,
    reference: row.reference,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}
