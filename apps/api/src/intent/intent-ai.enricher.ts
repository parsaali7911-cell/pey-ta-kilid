import {
  PromptJourney,
  RequestIntent,
  StructuredRequirements,
} from '@peytakilid/shared-types';
import { AiGatewayService } from '../ai/ai-gateway.service';

export type AiIntentEnrichment = {
  journey?: PromptJourney;
  intent?: RequestIntent;
  categorySlug?: string | null;
  specialty?: string | null;
  city?: string | null;
  preferCheapest?: boolean;
  sizeCm?: string | null;
  confidence?: number;
  reason?: string;
};

const JOURNEYS = new Set(Object.values(PromptJourney));
const INTENTS = new Set(Object.values(RequestIntent));

/**
 * Optional LLM pass to correct journey/slots when OpenAI is configured.
 * Never invents price/stock — only classifies demand.
 */
export async function enrichRequirementsWithAi(
  ai: AiGatewayService,
  requirements: StructuredRequirements,
): Promise<StructuredRequirements> {
  if (ai.getProviderName() === 'none') return requirements;
  const text = (requirements.rawText || '').trim();
  if (text.length < 2) return requirements;

  const system = `You classify Iranian building-materials marketplace demand.
Return ONLY compact JSON (no markdown) with keys:
journey, intent, categorySlug, specialty, city, preferCheapest, sizeCm, confidence, reason.

journey one of: BUY_PRODUCT, SELL_PRODUCT, REGISTER_PROFESSIONAL, FIND_PROFESSIONAL, DESIGN_ASSIST, UNKNOWN
intent one of: PRODUCT, PROFESSIONAL, DESIGN_ASSIST, AMBIGUOUS

Rules:
- "فروش X" / "می‌فروشم" / "فروشنده هستم" → SELL_PRODUCT
- "برق‌کار هستم" / "من نصابم" (self as trade) → REGISTER_PROFESSIONAL
- "دنبال Xکار" / "نقاش میخوام" (hiring) → FIND_PROFESSIONAL
- product need/buy → BUY_PRODUCT
- city must be Iranian city name in English Latin when known (Karaj, Tehran, Rasht…) else null
- specialty codes like electrical, painting, tile_installation, cabinet_making when clear else null
- categorySlug like ceramic-tile, cabinets, steel-rebar, windows when clear else null
- sizeCm like "80x80" when tile/cabinet size mentioned
- Do NOT invent prices, stock, sellers, or availability.`;

  const draft = {
    journey: requirements.journey,
    intent: requirements.intent,
    categorySlug: requirements.categorySlugHints?.[0] ?? null,
    specialty: requirements.specialtyHints?.[0] ?? null,
    city: requirements.location?.city ?? null,
    preferCheapest: Boolean(requirements.preferCheapest),
    attrs: requirements.attributeFilters,
  };

  try {
    const out = await ai.complete({
      system,
      prompt: `User text (${requirements.locale || 'fa'}):\n${text}\n\nRule draft JSON:\n${JSON.stringify(draft)}`,
      maxOutputTokens: 220,
    });
    const parsed = parseAiJson(out?.text || '');
    if (!parsed) return requirements;
    return mergeEnrichment(requirements, parsed);
  } catch {
    return requirements;
  }
}

function parseAiJson(text: string): AiIntentEnrichment | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as AiIntentEnrichment;
  } catch {
    return null;
  }
}

function mergeEnrichment(
  base: StructuredRequirements,
  ai: AiIntentEnrichment,
): StructuredRequirements {
  const journey =
    ai.journey && JOURNEYS.has(ai.journey) ? ai.journey : base.journey;
  let intent =
    ai.intent && INTENTS.has(ai.intent) ? ai.intent : base.intent;

  if (journey === PromptJourney.SELL_PRODUCT) intent = RequestIntent.PRODUCT;
  if (
    journey === PromptJourney.REGISTER_PROFESSIONAL ||
    journey === PromptJourney.FIND_PROFESSIONAL
  ) {
    intent = RequestIntent.PROFESSIONAL;
  }
  if (journey === PromptJourney.DESIGN_ASSIST) intent = RequestIntent.DESIGN_ASSIST;
  if (journey === PromptJourney.BUY_PRODUCT) intent = RequestIntent.PRODUCT;

  const categorySlugHints = [...(base.categorySlugHints || [])];
  if (ai.categorySlug && !categorySlugHints.includes(ai.categorySlug)) {
    categorySlugHints.unshift(ai.categorySlug);
  }

  const specialtyHints = [...base.specialtyHints];
  if (ai.specialty && !specialtyHints.includes(ai.specialty)) {
    specialtyHints.unshift(ai.specialty);
  }

  const attributeFilters = { ...base.attributeFilters };
  if (ai.sizeCm && !attributeFilters.size_cm) {
    attributeFilters.size_cm = ai.sizeCm;
  }

  const location = base.location
    ? { ...base.location }
    : { countryCode: null, region: null, province: null, city: null };
  if (ai.city && !location.city) location.city = ai.city;

  const aiConf =
    typeof ai.confidence === 'number' && Number.isFinite(ai.confidence)
      ? Math.max(0, Math.min(1, ai.confidence))
      : null;

  return {
    ...base,
    journey,
    intent,
    categorySlugHints,
    specialtyHints,
    attributeFilters,
    location: location.city || base.location ? location : base.location,
    preferCheapest: ai.preferCheapest ?? base.preferCheapest,
    confidence: Math.max(base.confidence, aiConf ?? base.confidence),
  };
}
