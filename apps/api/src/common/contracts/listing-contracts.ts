/** Frozen public/seller contracts for price + inventory serialization. */

const PUBLIC_FORBIDDEN_KEYS = [
  'supplierCost',
  'passwordHash',
  'fxRateApplied',
  'marginPercentApplied',
  'flatFeeApplied',
  'onHand',
  'reserved',
  'line1',
  'line2',
  'postalCode',
  'latitude',
  'longitude',
  'accuracyM',
] as const;

export type PublicPriceDto = {
  displayPrice: number;
  currency: string;
  priceType: string;
};

export type SellerPriceDto = PublicPriceDto & {
  supplierCost: number;
};

export type PublicInventoryDto = {
  available: number;
  uomCode: string;
};

export type SellerInventoryDto = PublicInventoryDto & {
  onHand: number;
  reserved: number;
};

export function toPublicPrice(price: {
  displayPrice: unknown;
  currency: string;
  priceType: string;
} | null): PublicPriceDto | null {
  if (!price) return null;
  return {
    displayPrice: Number(price.displayPrice),
    currency: price.currency,
    priceType: price.priceType,
  };
}

export function toSellerPrice(price: {
  displayPrice: unknown;
  currency: string;
  priceType: string;
  supplierCost: unknown;
} | null): SellerPriceDto | null {
  if (!price) return null;
  return {
    displayPrice: Number(price.displayPrice),
    currency: price.currency,
    priceType: price.priceType,
    supplierCost: Number(price.supplierCost),
  };
}

export function toPublicInventory(inventory: {
  onHand: unknown;
  reserved: unknown;
  uomCode: string;
} | null): PublicInventoryDto | null {
  if (!inventory) return null;
  const onHand = Number(inventory.onHand);
  const reserved = Number(inventory.reserved);
  return {
    available: Math.max(0, onHand - reserved),
    uomCode: inventory.uomCode,
  };
}

export function toSellerInventory(inventory: {
  onHand: unknown;
  reserved: unknown;
  uomCode: string;
} | null): SellerInventoryDto | null {
  if (!inventory) return null;
  const onHand = Number(inventory.onHand);
  const reserved = Number(inventory.reserved);
  return {
    onHand,
    reserved,
    available: Math.max(0, onHand - reserved),
    uomCode: inventory.uomCode,
  };
}

export function toPublicListing<T extends Record<string, unknown>>(listing: T) {
  const { price, inventory, ...rest } = listing as T & {
    price?: Parameters<typeof toPublicPrice>[0];
    inventory?: Parameters<typeof toPublicInventory>[0];
  };
  const publicListing = {
    ...rest,
    price: toPublicPrice(price ?? null),
    inventory: toPublicInventory(inventory ?? null),
  };
  assertNoPrivateLeak(publicListing);
  return publicListing;
}

export function assertNoPrivateLeak(payload: unknown): void {
  const json = JSON.stringify(payload);
  for (const key of PUBLIC_FORBIDDEN_KEYS) {
    // Match JSON object keys only: "supplierCost":
    if (json.includes(`"${key}"`)) {
      throw new Error(`Public contract leak detected: ${key}`);
    }
  }
}
