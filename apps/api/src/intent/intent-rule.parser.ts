import {
  BLOCKING_REQUIREMENT_FIELDS,
  ClarificationField,
  ClarificationPrompt,
  CurrencyCode,
  MAX_CLARIFICATION_FIELDS,
  PromptJourney,
  RequestIntent,
  StructuredRequirements,
  UOM_CODES,
} from '@peytakilid/shared-types';
import {
  CATEGORY_LEXICON_BUILT,
  IRAN_CITY_MATCHERS,
  IRAN_PROVINCE_MATCHERS,
  SPECIALTY_LEXICON_BUILT,
} from './lexicon/build-lexicon';

const PRODUCT_HINTS = [
  'buy',
  'purchase',
  'order',
  'need',
  'quote',
  'rfq',
  'خرید',
  'سفارش',
  'نیاز',
  'درخواست',
  'میخوام',
  'میخواهم',
  ...CATEGORY_LEXICON_BUILT.productHintTerms,
];

const PROFESSIONAL_HINTS = [
  'professional',
  'specialist',
  'متخصص',
  'architect',
  'معمار',
  'installer',
  'نصاب',
  'contractor',
  'پیمانکار',
  'engineer',
  'مهندس',
  'plumber',
  'electrician',
  'painter',
  'نقاش',
  'carpenter',
  'نجار',
  'welder',
  'جوشکار',
  'mason',
  'بنا',
];

const DESIGN_HINTS = [
  'design assist',
  'design help',
  'moodboard',
  'match color',
  'match colour',
  'from image',
  'vision',
  'lookalike',
  'طراحی',
  'از روی عکس',
  'شبیه',
  'رنگ مشابه',
];

const CATEGORY_LEXICON = CATEGORY_LEXICON_BUILT.lexicon;
const CATEGORY_SLUG_BY_HINT = CATEGORY_LEXICON_BUILT.slugByHint;
const SPECIALTY_LEXICON = SPECIALTY_LEXICON_BUILT.lexicon;

/** Soft hints shown in UI / text ranking — never hard-exclude catalog rows. */
export const SOFT_ATTRIBUTE_KEYS = new Set([
  'size_cm',
  'size',
  'paint_type',
  'material',
  'finish',
]);

const ATTRIBUTE_PATTERNS: Array<{ key: string; patterns: RegExp[] }> = [
  {
    key: 'color',
    patterns: [
      /\b(?:color|colour)\s*[:=]?\s*([a-zA-Z\u0600-\u06FF]+)/i,
      /رنگ\s+(?!روغن|پلاستیک|آکریلیک|اکریلیک|ساختمانی)([^\s,،]+)/,
    ],
  },
  { key: 'finish', patterns: [/\bfinish\s*[:=]?\s*([a-zA-Z]+)/i, /پرداخت\s*[:=]?\s*([^\s,،]+)/] },
  { key: 'thicknessMm', patterns: [/\b(\d+(?:\.\d+)?)\s*mm\b/i, /ضخامت\s*[:=]?\s*(\d+(?:\.\d+)?)/] },
];

const CLARIFICATION_QUESTIONS: Record<string, string> = {
  intent: 'Are you looking for a product, a professional, or design assistance?',
  quantity: 'What quantity do you need?',
  uomCode: 'What unit of measure should we use (e.g. m2, pcs, ton)?',
  categoryHints: 'Which product category are you looking for?',
  'location.city': 'Which city should we search near?',
  specialtyHints: 'Which professional specialty do you need?',
  'budget.currency': 'Which currency is your budget in?',
};

export type RuleParseInput = {
  text: string;
  locale?: string | null;
  market?: string | null;
  imageAssetId?: string | null;
};

export function parseNaturalLanguageRules(input: RuleParseInput): StructuredRequirements {
  const rawText = normalizeDigits((input.text ?? '').trim());
  const normalized = rawText.toLowerCase();

  const categoryHints = extractHints(CATEGORY_LEXICON, rawText);
  let specialtyHints = extractHints(SPECIALTY_LEXICON, rawText);
  // "سرامیک‌کار" already in specialty; if only tile+کار pattern via compound, ensure specialty
  if (!specialtyHints.length && /(?:کار)\b/.test(rawText) && categoryHints.includes('tile')) {
    specialtyHints = ['tile_installation'];
  }
  const { quantity, uomCode } = extractQuantityUom(rawText);
  const budget = extractBudget(rawText);
  const location = extractLocation(rawText);
  const facilityProximity = extractFacilityProximity(rawText);
  const listingIdHints = extractListingIds(rawText);
  const attributeFilters = extractAttributes(rawText);
  const categorySlugHints = categoryHints
    .map((h) => CATEGORY_SLUG_BY_HINT[h])
    .filter((s): s is string => Boolean(s));

  const journey = classifyJourney(rawText, normalized, {
    categoryHints,
    specialtyHints,
  });

  let intent = classifyIntent(normalized, {
    categoryHints,
    specialtyHints,
    listingIdHints,
    hasImageAsset: Boolean(input.imageAssetId),
  });

  // Journey overrides classic intent when the speaker role is clear.
  if (journey === PromptJourney.SELL_PRODUCT) {
    intent = RequestIntent.PRODUCT;
  } else if (
    journey === PromptJourney.REGISTER_PROFESSIONAL ||
    journey === PromptJourney.FIND_PROFESSIONAL
  ) {
    intent = RequestIntent.PROFESSIONAL;
  } else if (journey === PromptJourney.DESIGN_ASSIST) {
    intent = RequestIntent.DESIGN_ASSIST;
  } else if (journey === PromptJourney.BUY_PRODUCT) {
    intent = RequestIntent.PRODUCT;
  }

  const missingFields = computeMissingFields({
    intent,
    journey,
    quantity,
    uomCode,
    categoryHints,
    specialtyHints,
    location,
    budget,
  });

  const confidence = computeConfidence({
    intent,
    quantity,
    uomCode,
    categoryHints,
    specialtyHints,
    location,
    listingIdHints,
    missingFields,
  });

  return {
    intent,
    journey,
    categorySlugHints,
    market: input.market ?? null,
    locale: input.locale ?? null,
    quantity,
    uomCode,
    categoryHints,
    attributeFilters,
    budget,
    location,
    facilityProximity,
    listingIdHints,
    specialtyHints,
    confidence,
    missingFields,
    rawText: rawText || null,
  };
}

export function buildClarificationPrompt(
  requirements: StructuredRequirements,
): ClarificationPrompt | null {
  const fields: ClarificationField[] = [];
  for (const field of requirements.missingFields) {
    if (!BLOCKING_REQUIREMENT_FIELDS.includes(field as (typeof BLOCKING_REQUIREMENT_FIELDS)[number])) {
      continue;
    }
    fields.push({
      field,
      question: CLARIFICATION_QUESTIONS[field] ?? `Please provide ${field}`,
      reason: 'blocking',
    });
    if (fields.length >= MAX_CLARIFICATION_FIELDS) break;
  }
  if (fields.length === 0) return null;
  return { fields };
}

function classifyJourney(
  rawText: string,
  normalized: string,
  ctx: { categoryHints: string[]; specialtyHints: string[] },
): PromptJourney {
  const sellerSelf =
    /(?:^|[\s،,])(?:من\s+)?(?:یک\s+)?(?:فروشنده|تأمین[\u200c\s]*کننده|تامین[\u200c\s]*کننده|تولیدکننده|کارخانه)(?:\s+ی|\s+یِ)?/i.test(
      rawText,
    ) ||
    /\bi\s+am\s+(?:a\s+|an\s+)?(?:seller|supplier|manufacturer|factory)\b/i.test(normalized) ||
    /\bwe\s+(?:sell|supply|manufacture)\b/i.test(normalized);

  const proTradeWord =
    /(?:گچ|سرامیک|کاشی|برق|لوله|سنگ|کناف|کفپوش|پارکت|ایزوگام|عایق|پنجره|کابینت)[\u200c\s]*کار|نصاب|معمار|پیمانکار|نقاش|متخصص|بنا|نجار|جوشکار|آهنگر|لول[هه‌][\u200c\s]*کش|آرماتوربند|داربست/i.test(
      rawText,
    ) || ctx.specialtyHints.length > 0;

  const firstPerson =
    /(?:^|[\s،,])من\s+/i.test(rawText) ||
    /\b(?:هستم|ام)\b/i.test(rawText) ||
    /\bi\s+am\b/i.test(normalized);

  const seeker =
    /دنبال|به\s*دنبال|می[\u200c]?خوا(?:م|هم)|نیاز\s*به|معرفی\s*کن|پیدا\s*کن|درخواست/i.test(rawText) ||
    /\b(?:looking\s+for|need\s+(?:a|an)|find\s+(?:me\s+)?(?:a|an)|hire|want|request)\b/i.test(
      normalized,
    );

  const buyerProduct =
    /می[\u200c]?خوا(?:م|هم)|درخواست|خرید|سفارش|نیاز\s*به|برای\s+.+\s*(?:می[\u200c]?خوا|لازم)/i.test(
      rawText,
    ) || /\b(?:want|need|buy|order|request|looking\s+for)\b/i.test(normalized);

  if (sellerSelf && (ctx.categoryHints.length > 0 || /سرامیک|کاشی|سنگ|سیمان|رنگ|میلگرد/i.test(rawText))) {
    return PromptJourney.SELL_PRODUCT;
  }
  if (sellerSelf) return PromptJourney.SELL_PRODUCT;

  // "من گچ‌کار هستم" / "I am a plasterer" — not "من دنبال … هستم"
  if (firstPerson && proTradeWord && !seeker && !buyerProduct) {
    return PromptJourney.REGISTER_PROFESSIONAL;
  }
  if (proTradeWord && /هستم|am a|am an/i.test(rawText) && !seeker && !buyerProduct) {
    return PromptJourney.REGISTER_PROFESSIONAL;
  }

  // "دنبال سرامیک‌کار / نقاش هستم"
  if (seeker && proTradeWord) {
    return PromptJourney.FIND_PROFESSIONAL;
  }
  if (seeker && ctx.specialtyHints.length > 0 && !ctx.categoryHints.length) {
    return PromptJourney.FIND_PROFESSIONAL;
  }

  if (hasDesignCue(normalized)) return PromptJourney.DESIGN_ASSIST;
  if (ctx.specialtyHints.length > 0 && !ctx.categoryHints.length && !buyerProduct) {
    return PromptJourney.FIND_PROFESSIONAL;
  }
  // Mixed product+trade words without a clear buyer/seeker cue → leave to intent classifier.
  if (ctx.categoryHints.length > 0 && ctx.specialtyHints.length > 0 && !buyerProduct && !seeker) {
    return PromptJourney.UNKNOWN;
  }
  if (ctx.categoryHints.length > 0) return PromptJourney.BUY_PRODUCT;
  return PromptJourney.UNKNOWN;
}

function classifyIntent(
  normalized: string,
  ctx: {
    categoryHints: string[];
    specialtyHints: string[];
    listingIdHints: string[];
    hasImageAsset: boolean;
  },
): RequestIntent {
  const designScore =
    (hasDesignCue(normalized) ? 2 : 0) + (ctx.hasImageAsset ? 2 : 0);
  const productScore =
    scoreHints(normalized, PRODUCT_HINTS) +
    ctx.categoryHints.length +
    (ctx.listingIdHints.length > 0 ? 1 : 0) +
    (/\b\d+\s*(m2|m²|pcs|kg|ton)\b/i.test(normalized) ? 1 : 0);
  const professionalScore =
    scoreHints(normalized, PROFESSIONAL_HINTS) + ctx.specialtyHints.length;

  if (designScore >= 2 && designScore >= productScore && designScore >= professionalScore) {
    return RequestIntent.DESIGN_ASSIST;
  }
  // Ambiguous only when both commerce and pro domains are clearly present
  // without a dominant professional role word.
  const mixedDomains =
    (ctx.categoryHints.length > 0 || ctx.listingIdHints.length > 0) &&
    ctx.specialtyHints.length > 0;
  const strongProRole = scoreHints(normalized, PROFESSIONAL_HINTS) >= 1;
  if (
    mixedDomains &&
    productScore > 0 &&
    professionalScore > 0 &&
    Math.abs(productScore - professionalScore) <= 1 &&
    !strongProRole
  ) {
    return RequestIntent.AMBIGUOUS;
  }
  // "نصاب کاشی" → professional even if product score is slightly higher (نیاز+کاشی).
  if (strongProRole && ctx.specialtyHints.length > 0) {
    return RequestIntent.PROFESSIONAL;
  }
  if (professionalScore > productScore && professionalScore > 0) {
    return RequestIntent.PROFESSIONAL;
  }
  if (productScore > professionalScore && productScore > 0) {
    return RequestIntent.PRODUCT;
  }
  if (productScore > 0 && professionalScore > 0) {
    return RequestIntent.AMBIGUOUS;
  }
  if (productScore > 0) {
    return RequestIntent.PRODUCT;
  }
  if (professionalScore > 0) {
    return RequestIntent.PROFESSIONAL;
  }
  if (designScore > 0) {
    return RequestIntent.DESIGN_ASSIST;
  }
  return RequestIntent.AMBIGUOUS;
}

function hasDesignCue(normalized: string): boolean {
  return DESIGN_HINTS.some((h) => normalized.includes(h));
}

function scoreHints(normalized: string, hints: string[]): number {
  return hints.reduce((n, h) => (normalized.includes(h) ? n + 1 : n), 0);
}

function extractHints(
  lexicon: Array<{ hint: string; patterns: RegExp[] }>,
  text: string,
): string[] {
  const out: string[] = [];
  for (const entry of lexicon) {
    if (entry.patterns.some((p) => p.test(text))) out.push(entry.hint);
  }
  return out;
}

function extractQuantityUom(text: string): {
  quantity: number | null;
  uomCode: string | null;
} {
  const uomAlt = UOM_CODES.join('|');
  const withUom = text.match(
    new RegExp(
      `(\\d+(?:[.,]\\d+)?)\\s*(m²|m2|متر\\s*مربع|مترمربع|متر|${uomAlt})(?=\\s|$|[^\\w\\u0600-\\u06FF])`,
      'i',
    ),
  );
  if (withUom) {
    const quantity = Number(withUom[1].replace(',', '.'));
    let uom = withUom[2].toLowerCase().replace(/\s+/g, '');
    if (uom === 'm²' || uom === 'متر' || uom === 'مترمربع' || uom.includes('مربع')) {
      uom = 'm2';
    }
    return {
      quantity: Number.isFinite(quantity) ? quantity : null,
      uomCode: (UOM_CODES as readonly string[]).includes(uom) ? uom : uom === 'm2' ? 'm2' : null,
    };
  }
  const qtyOnly = text.match(
    /\b(?:qty|quantity|مقدار|تعداد)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
  );
  if (qtyOnly) {
    const quantity = Number(qtyOnly[1].replace(',', '.'));
    return { quantity: Number.isFinite(quantity) ? quantity : null, uomCode: null };
  }
  return { quantity: null, uomCode: null };
}

function normalizeDigits(text: string): string {
  const map: Record<string, string> = {
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9',
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };
  return text.replace(/[۰-۹٠-٩]/g, (d) => map[d] || d);
}

function extractBudget(text: string): StructuredRequirements['budget'] {
  const currencyCodes = Object.values(CurrencyCode);
  const currencyMatch = text.match(
    new RegExp(`\\b(${currencyCodes.join('|')})\\b`, 'i'),
  );
  const range = text.match(
    /(?:budget|بودجه|قیمت)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:-|to|تا)\s*(\d+(?:[.,]\d+)?)/i,
  );
  const maxOnly = text.match(
    /(?:budget|max|under|بودجه|تا)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
  );
  if (!currencyMatch && !range && !maxOnly) return null;
  const currency = currencyMatch ? currencyMatch[1].toUpperCase() : null;
  if (range) {
    return {
      min: Number(range[1].replace(',', '.')),
      max: Number(range[2].replace(',', '.')),
      currency,
    };
  }
  if (maxOnly) {
    return {
      min: null,
      max: Number(maxOnly[1].replace(',', '.')),
      currency,
    };
  }
  return { min: null, max: null, currency };
}

function extractLocation(text: string): StructuredRequirements['location'] {
  for (const city of IRAN_CITY_MATCHERS) {
    if (city.patterns.some((p) => p.test(text))) {
      return {
        countryCode: city.countryCode,
        region: null,
        province: city.province,
        city: city.city,
      };
    }
  }
  for (const prov of IRAN_PROVINCE_MATCHERS) {
    if (prov.patterns.some((p) => p.test(text))) {
      return {
        countryCode: prov.countryCode,
        region: null,
        province: prov.province,
        city: null,
      };
    }
  }
  const generic = text.match(
    /\b(?:in|near|at|برای|در|نزدیک|تو\s*محدوده(?:\s*ی)?|در\s*محدوده(?:\s*ی)?|محدوده(?:\s*ی)?)\s+([A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s-]{1,40})/i,
  );
  if (generic) {
    return {
      countryCode: null,
      region: null,
      province: null,
      city: generic[1].trim(),
    };
  }
  return null;
}

function extractFacilityProximity(
  text: string,
): StructuredRequirements['facilityProximity'] {
  const idMatch = text.match(
    /\b(?:near\s+facility|facility)\s*[:=]?\s*([a-zA-Z0-9_-]{8,})/i,
  );
  const radiusMatch = text.match(/\bwithin\s+(\d+(?:\.\d+)?)\s*km\b/i);
  const preferPublic = /public\s+(?:location|facility)|مکان\s+عمومی/i.test(text);
  if (!idMatch && !radiusMatch && !preferPublic) return null;
  return {
    nearFacilityId: idMatch?.[1] ?? null,
    radiusKm: radiusMatch ? Number(radiusMatch[1]) : null,
    preferPublicLocation: preferPublic ? true : undefined,
  };
}

function extractListingIds(text: string): string[] {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  const listingLabeled = /\blisting[:\s]+([a-zA-Z0-9_-]{6,})/gi;
  while ((m = listingLabeled.exec(text)) !== null) ids.add(m[1]);
  const lstPrefixed = /\blst_[a-zA-Z0-9_-]{6,}\b/gi;
  while ((m = lstPrefixed.exec(text)) !== null) ids.add(m[0]);
  const uuid =
    /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/gi;
  while ((m = uuid.exec(text)) !== null) ids.add(m[1]);
  return [...ids];
}

function extractAttributes(text: string): Record<string, string | number | boolean | string[]> {
  const attrs: Record<string, string | number | boolean | string[]> = {};

  const size = text.match(/(\d+)\s*[x×*✕]\s*(\d+)/i);
  if (size) {
    attrs.size_cm = `${size[1]}x${size[2]}`;
  }

  if (/\bupvc\b|upcvc|یو[\u200c\s]*پی[\u200c\s]*وی[\u200c\s]*سی/i.test(text)) {
    attrs.material = 'upvc';
  }

  if (/رنگ\s*روغن|\boil\s*paint\b/i.test(text)) {
    attrs.paint_type = 'oil';
  } else if (/رنگ\s*پلاستیک|\bplastic\s*paint\b/i.test(text)) {
    attrs.paint_type = 'plastic';
  } else if (/رنگ\s*(?:آ|ا)کریلیک|\bacrylic\s*paint\b/i.test(text)) {
    attrs.paint_type = 'acrylic';
  }

  for (const entry of ATTRIBUTE_PATTERNS) {
    if (attrs[entry.key] != null) continue;
    for (const pattern of entry.patterns) {
      const m = text.match(pattern);
      if (!m?.[1]) continue;
      if (entry.key === 'thicknessMm') {
        attrs[entry.key] = Number(m[1]);
      } else {
        attrs[entry.key] = m[1];
      }
      break;
    }
  }
  return attrs;
}

function computeMissingFields(input: {
  intent: RequestIntent;
  journey?: PromptJourney;
  quantity: number | null;
  uomCode: string | null;
  categoryHints: string[];
  specialtyHints: string[];
  location: StructuredRequirements['location'];
  budget: StructuredRequirements['budget'];
}): string[] {
  const missing: string[] = [];
  const journey = input.journey || PromptJourney.UNKNOWN;

  if (journey === PromptJourney.SELL_PRODUCT) {
    if (!input.categoryHints.length) missing.push('categoryHints');
    return missing;
  }
  if (journey === PromptJourney.BUY_PRODUCT) {
    // Buyer prompts should open search/RFQ with category; qty/city refine ranking.
    if (!input.categoryHints.length) missing.push('categoryHints');
    return missing;
  }
  if (journey === PromptJourney.REGISTER_PROFESSIONAL) {
    if (!input.specialtyHints.length) missing.push('specialtyHints');
    return missing;
  }
  if (journey === PromptJourney.FIND_PROFESSIONAL) {
    if (!input.specialtyHints.length) missing.push('specialtyHints');
    if (!input.location?.city && !input.location?.province) missing.push('location.city');
    return missing;
  }

  if (input.intent === RequestIntent.AMBIGUOUS) missing.push('intent');

  if (input.intent === RequestIntent.PRODUCT || input.intent === RequestIntent.DESIGN_ASSIST) {
    if (!input.categoryHints.length) missing.push('categoryHints');
    if (input.intent === RequestIntent.PRODUCT) {
      if (input.quantity == null) missing.push('quantity');
      if (!input.uomCode) missing.push('uomCode');
    }
  }

  if (input.intent === RequestIntent.PROFESSIONAL) {
    if (!input.specialtyHints.length) missing.push('specialtyHints');
    if (!input.location?.city) missing.push('location.city');
  }

  if (input.budget && input.budget.max != null && !input.budget.currency) {
    missing.push('budget.currency');
  }

  return missing;
}

function computeConfidence(input: {
  intent: RequestIntent;
  quantity: number | null;
  uomCode: string | null;
  categoryHints: string[];
  specialtyHints: string[];
  location: StructuredRequirements['location'];
  listingIdHints: string[];
  missingFields: string[];
}): number {
  let score = 0.35;
  if (input.intent !== RequestIntent.AMBIGUOUS) score += 0.2;
  if (input.categoryHints.length) score += 0.1;
  if (input.specialtyHints.length) score += 0.1;
  if (input.quantity != null) score += 0.08;
  if (input.uomCode) score += 0.07;
  if (input.location?.city) score += 0.05;
  if (input.listingIdHints.length) score += 0.1;
  score -= Math.min(0.25, input.missingFields.length * 0.08);
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}
