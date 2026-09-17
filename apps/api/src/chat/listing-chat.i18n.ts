import { AiGatewayService } from '../ai/ai-gateway.service';

const FA_RE = /[\u0600-\u06FF]/;
const AR_EXTRA_RE = /[\u0750-\u077F\u08A0-\u08FF]/;
const LATIN_RE = /[A-Za-z]/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const CJK_RE = /[\u3040-\u30ff\u3400-\u9fff]/;

export type ChatLang = 'fa' | 'en' | 'ar' | 'ru' | 'zh' | 'tr' | 'de' | 'fr' | 'es' | 'other';

export type ChatTranslation = {
  sourceLang: string;
  bodyFa: string;
  bodyForBuyer: string;
  translated: boolean;
  provider: string;
};

/** Normalize UI/locale codes used by the site. */
export function normalizeChatLocale(raw?: string | null): string {
  const v = (raw || '').trim().toLowerCase().split(/[-_]/)[0];
  if (!v) return 'fa';
  if (v === 'fa' || v === 'per' || v === 'fas') return 'fa';
  if (v === 'ar' || v === 'ara') return 'ar';
  if (v === 'en' || v === 'eng') return 'en';
  return v.slice(0, 8);
}

/**
 * Fast heuristic language guess for chat (no LLM).
 * Prefer page locale when the script is ambiguous.
 */
export function detectChatLanguage(text: string, hintLocale?: string | null): string {
  const t = (text || '').trim();
  const hint = normalizeChatLocale(hintLocale);
  if (!t) return hint || 'fa';

  const fa = (t.match(FA_RE) || []).length;
  const arExtra = (t.match(AR_EXTRA_RE) || []).length;
  const latin = (t.match(LATIN_RE) || []).length;
  const cyr = (t.match(CYRILLIC_RE) || []).length;
  const cjk = (t.match(CJK_RE) || []).length;
  const letters = fa + arExtra + latin + cyr + cjk;

  if (cjk > letters * 0.3) return 'zh';
  if (cyr > letters * 0.3) return 'ru';
  if (fa + arExtra > letters * 0.25) {
    // Arabic vs Persian: Arabic-specific letters or UI hint.
    if (arExtra > 0 || hint === 'ar') return 'ar';
    return 'fa';
  }
  if (latin > letters * 0.25) {
    if (hint && hint !== 'fa' && hint !== 'ar') return hint;
    return 'en';
  }
  return hint || 'fa';
}

export function isPersianLocale(lang?: string | null): boolean {
  return normalizeChatLocale(lang) === 'fa';
}

function langLabel(code: string): string {
  const map: Record<string, string> = {
    fa: 'Persian (Farsi)',
    en: 'English',
    ar: 'Arabic',
    ru: 'Russian',
    zh: 'Chinese',
    tr: 'Turkish',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
  };
  return map[normalizeChatLocale(code)] || code;
}

/**
 * Translate chat text via OpenAI gateway when configured.
 * Failures return the original text (never block chat).
 */
export async function translateChatText(
  ai: AiGatewayService,
  text: string,
  targetLang: string,
  sourceLang?: string | null,
): Promise<{ text: string; translated: boolean; provider: string }> {
  const target = normalizeChatLocale(targetLang);
  const source = sourceLang ? normalizeChatLocale(sourceLang) : null;
  const trimmed = (text || '').trim();
  if (!trimmed) return { text: '', translated: false, provider: 'none' };
  if (source && source === target) {
    return { text: trimmed, translated: false, provider: 'none' };
  }
  if (!source && detectChatLanguage(trimmed) === target) {
    return { text: trimmed, translated: false, provider: 'none' };
  }
  if (ai.getProviderName() === 'none') {
    return { text: trimmed, translated: false, provider: 'none' };
  }

  try {
    const out = await ai.complete({
      system: `You are a precise bilingual chat translator for an Iranian building-materials export marketplace (Peytakilid).
Translate the user message into ${langLabel(target)}.
Keep numbers, sizes (e.g. 60x60), currency codes, product names, and proper nouns.
Do not add greetings, notes, or quotation marks.
Return ONLY the translation text.`,
      prompt: source
        ? `Source language: ${langLabel(source)}\nTarget language: ${langLabel(target)}\n\nMessage:\n${trimmed}`
        : `Target language: ${langLabel(target)}\n\nMessage:\n${trimmed}`,
      maxOutputTokens: Math.min(800, Math.max(120, Math.ceil(trimmed.length * 1.2))),
    });
    const translated = (out?.text || '').trim();
    if (!translated) return { text: trimmed, translated: false, provider: ai.getProviderName() };
    return { text: translated, translated: true, provider: ai.getProviderName() };
  } catch {
    return { text: trimmed, translated: false, provider: ai.getProviderName() };
  }
}

/** Prepare buyer message fields: staff always get Persian. */
export async function prepareBuyerMessageBodies(
  ai: AiGatewayService,
  body: string,
  hintLocale?: string | null,
): Promise<ChatTranslation> {
  const sourceLang = detectChatLanguage(body, hintLocale);
  if (isPersianLocale(sourceLang)) {
    return {
      sourceLang: 'fa',
      bodyFa: body,
      bodyForBuyer: body,
      translated: false,
      provider: 'none',
    };
  }
  const toFa = await translateChatText(ai, body, 'fa', sourceLang);
  return {
    sourceLang,
    // When OpenAI is off, keep original but tag language so staff can still read it.
    bodyFa: toFa.translated ? toFa.text : `[${sourceLang}] ${body}`,
    bodyForBuyer: body,
    translated: toFa.translated,
    provider: toFa.provider,
  };
}

/** Prepare staff (seller/admin) message: buyer gets thread language. */
export async function prepareStaffMessageBodies(
  ai: AiGatewayService,
  bodyFa: string,
  buyerLocale?: string | null,
): Promise<ChatTranslation> {
  const target = normalizeChatLocale(buyerLocale || 'fa');
  if (isPersianLocale(target)) {
    return {
      sourceLang: 'fa',
      bodyFa,
      bodyForBuyer: bodyFa,
      translated: false,
      provider: 'none',
    };
  }
  const toBuyer = await translateChatText(ai, bodyFa, target, 'fa');
  return {
    sourceLang: 'fa',
    bodyFa,
    // Without OpenAI, buyer still receives Persian with a language tag — better than dropping the reply.
    bodyForBuyer: toBuyer.translated
      ? toBuyer.text
      : target === 'en'
        ? `[Persian reply — enable OpenAI for auto-translate]\n${bodyFa}`
        : `[fa→${target}]\n${bodyFa}`,
    translated: toBuyer.translated,
    provider: toBuyer.provider,
  };
}

/** Assistant: keep FA facts for staff, localize for buyer. */
export async function prepareAssistantMessageBodies(
  ai: AiGatewayService,
  bodyFa: string,
  buyerLocale?: string | null,
): Promise<ChatTranslation> {
  return prepareStaffMessageBodies(ai, bodyFa, buyerLocale);
}
