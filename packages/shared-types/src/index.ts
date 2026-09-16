export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
  FINANCE = 'FINANCE',
  USER = 'USER',
}

export enum OrgRole {
  ORG_OWNER = 'ORG_OWNER',
  ORG_ADMIN = 'ORG_ADMIN',
  ORG_STAFF = 'ORG_STAFF',
  ORG_VIEWER = 'ORG_VIEWER',
}

export enum AttributeDataType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  ENUM = 'ENUM',
  RANGE = 'RANGE',
}

export enum ListingStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum MediaStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PRIVATE = 'PRIVATE',
}

export enum CurrencyCode {
  IRR = 'IRR',
  USD = 'USD',
  EUR = 'EUR',
  AED = 'AED',
  GBP = 'GBP',
}

export enum PriceType {
  EXW = 'EXW',
  FOB = 'FOB',
  CIF = 'CIF',
  CFR = 'CFR',
  DAP = 'DAP',
  DDP = 'DDP',
  OTHER = 'OTHER',
}

/** Incoterm foundation alias for upcoming RFQ/Quote (same codes as PriceType). */
export type IncotermCode = PriceType;
export const INCOTERM_CODES = Object.values(PriceType);

export const SUPPORTED_CURRENCY_CODES = Object.values(CurrencyCode);

export enum MarketCode {
  IRAN = 'IRAN',
  INTERNATIONAL = 'INTERNATIONAL',
}

export enum TextDirection {
  LTR = 'LTR',
  RTL = 'RTL',
}

export const BUILTIN_LOCALES = [
  { code: 'fa', nameEn: 'Persian', nameNative: 'فارسی', direction: TextDirection.RTL, isDefault: true },
  { code: 'en', nameEn: 'English', nameNative: 'English', direction: TextDirection.LTR, isDefault: false },
  { code: 'ar', nameEn: 'Arabic', nameNative: 'العربية', direction: TextDirection.RTL, isDefault: false },
] as const;

export type LocaleCode = (typeof BUILTIN_LOCALES)[number]['code'] | (string & {});

export function localeDirection(code: string): TextDirection {
  const found = BUILTIN_LOCALES.find((l) => l.code === code);
  if (found) return found.direction;
  return TextDirection.LTR;
}

export function isRtlLocale(code: string): boolean {
  return localeDirection(code) === TextDirection.RTL;
}

export function resolveLocalizedValue(input: {
  locale: string;
  defaultLocale?: string;
  translations: Record<string, string | null | undefined>;
  fallback?: string | null;
}): string | null {
  const { locale, translations, fallback = null } = input;
  const defaultLocale = input.defaultLocale ?? 'en';
  return (
    translations[locale] ||
    translations[defaultLocale] ||
    translations.en ||
    fallback ||
    null
  );
}

export enum RoundingMode {
  NONE = 'NONE',
  ROUND_NEAREST = 'ROUND_NEAREST',
  ROUND_UP = 'ROUND_UP',
  ROUND_DOWN = 'ROUND_DOWN',
}

export enum InventoryLedgerType {
  IN = 'IN',
  OUT = 'OUT',
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
  ADJUST = 'ADJUST',
}

export enum FacilityType {
  FACTORY = 'FACTORY',
  WAREHOUSE = 'WAREHOUSE',
  OFFICE = 'OFFICE',
  SHOWROOM = 'SHOWROOM',
  SERVICE_LOCATION = 'SERVICE_LOCATION',
}

export enum FacilityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

export const UOM_CODES = [
  'pcs',
  'm',
  'm2',
  'm3',
  'kg',
  'ton',
  'set',
  'roll',
  'pair',
  'box',
] as const;

export type UomCode = (typeof UOM_CODES)[number];

/** Base SI-ish factors to a canonical base where conversions are defined. */
export const DEFAULT_UOM_FACTORS_TO_BASE: Record<string, { base: string; factor: number }> = {
  kg: { base: 'kg', factor: 1 },
  ton: { base: 'kg', factor: 1000 },
  m: { base: 'm', factor: 1 },
  m2: { base: 'm2', factor: 1 },
  m3: { base: 'm3', factor: 1 },
  pcs: { base: 'pcs', factor: 1 },
  set: { base: 'set', factor: 1 },
  roll: { base: 'roll', factor: 1 },
  pair: { base: 'pcs', factor: 2 },
  box: { base: 'box', factor: 1 },
};

export type PublicUser = {
  id: string;
  email: string;
  fullName: string | null;
  platformRole: PlatformRole;
};

export type PricingRulesInput = {
  marginPercent: number;
  flatFee: number;
  roundingMode: RoundingMode;
  roundingUnit: number | null;
  fxRate: number;
};

export function calculateBuyerDisplayPrice(
  supplierCost: number,
  rules: PricingRulesInput,
): {
  displayPrice: number;
  fxRateApplied: number;
  marginPercentApplied: number;
  flatFeeApplied: number;
} {
  if (supplierCost < 0) throw new Error('supplierCost must be >= 0');
  const fx = rules.fxRate > 0 ? rules.fxRate : 1;
  const converted = supplierCost * fx;
  const withMargin = converted * (1 + rules.marginPercent / 100);
  const withFee = withMargin + (rules.flatFee || 0);
  const displayPrice = applyRounding(withFee, rules.roundingMode, rules.roundingUnit);
  return {
    displayPrice,
    fxRateApplied: fx,
    marginPercentApplied: rules.marginPercent,
    flatFeeApplied: rules.flatFee || 0,
  };
}

export function applyRounding(
  value: number,
  mode: RoundingMode,
  unit: number | null,
): number {
  if (mode === RoundingMode.NONE || !unit || unit <= 0) {
    return roundMoney(value);
  }
  const n = value / unit;
  let rounded: number;
  switch (mode) {
    case RoundingMode.ROUND_UP:
      rounded = Math.ceil(n) * unit;
      break;
    case RoundingMode.ROUND_DOWN:
      rounded = Math.floor(n) * unit;
      break;
    case RoundingMode.ROUND_NEAREST:
    default:
      rounded = Math.round(n) * unit;
      break;
  }
  return roundMoney(rounded);
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function availableQuantity(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

export * from './intent';
export * from './search';
export * from './ai';
export * from './translation';
export * from './rfq';
export * from './quote';
export * from './order';
export * from './seo';
export * from './lexicon';
