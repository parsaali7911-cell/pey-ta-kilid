import { createHash } from 'crypto';

export const SUPPORTED_TRANSLATION_LOCALES = ['fa', 'en', 'ar'] as const;
export type TranslationLocaleCode = (typeof SUPPORTED_TRANSLATION_LOCALES)[number];

export const TRANSLATABLE_CONTENT_FIELDS = [
  'title',
  'description',
  'name',
  'seoTitle',
  'seoDescription',
] as const;
export type TranslatableContentField = (typeof TRANSLATABLE_CONTENT_FIELDS)[number];

export enum TranslationJobStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  FAILED = 'FAILED',
  STALE = 'STALE',
  SKIPPED = 'SKIPPED',
}

export enum AiUsageOperation {
  TRANSLATION = 'TRANSLATION',
  COMPLETE = 'COMPLETE',
  EMBED = 'EMBED',
  VISION = 'VISION',
}

export type TranslationFieldInput = {
  field: TranslatableContentField | string;
  sourceText: string | null | undefined;
};

export type TranslateContentRequest = {
  entityType: string;
  entityId: string;
  sourceLocale: string;
  targetLocales?: string[];
  fields: TranslationFieldInput[];
  organizationId?: string | null;
  actorUserId?: string | null;
};

export type TranslationFieldResult = {
  field: string;
  targetLocale: string;
  status: TranslationJobStatus;
  translatedText: string | null;
  sourceHash: string;
  cached: boolean;
  errorMessage?: string | null;
};

export type TranslateContentResult = {
  entityType: string;
  entityId: string;
  sourceLocale: string;
  results: TranslationFieldResult[];
  preservedSource: Record<string, string | null>;
};

export type ScheduleTranslationResult = {
  accepted: true;
  mode: 'async';
  entityType: string;
  entityId: string;
};

export type AiUsageRecordInput = {
  provider: string;
  operation: AiUsageOperation;
  sourceLocale?: string | null;
  targetLocale?: string | null;
  model?: string | null;
  requestCount?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  field?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AiUsageSummary = {
  operation: AiUsageOperation | string;
  provider: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export function hashTranslationSource(sourceText: string, sourceLocale: string): string {
  return createHash('sha256').update(`${sourceLocale}\n${sourceText}`).digest('hex');
}

export function defaultTargetLocales(sourceLocale: string): string[] {
  return SUPPORTED_TRANSLATION_LOCALES.filter((l) => l !== sourceLocale);
}

export function normalizeSourceText(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.trim().length === 0) return null;
  return value;
}

export function sanitizeAiUsageMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const blocked = /api[_-]?key|authorization|bearer|secret|token/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (blocked.test(k)) continue;
    if (typeof v === 'string' && /sk-[a-zA-Z0-9]{10,}/.test(v)) continue;
    out[k] = v;
  }
  return out;
}

export function estimateOpenAiCostUsd(input: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  inputPer1M?: number;
  outputPer1M?: number;
}): number | null {
  const inTok = input.inputTokens ?? null;
  const outTok = input.outputTokens ?? null;
  if (inTok == null && outTok == null) return null;
  const cost =
    ((inTok ?? 0) / 1_000_000) * (input.inputPer1M ?? 0.15) +
    ((outTok ?? 0) / 1_000_000) * (input.outputPer1M ?? 0.6);
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function buildTranslationSystemPrompt(): string {
  return [
    'You are a professional localization engine for a building-materials marketplace.',
    'Translate the user JSON fields into the requested target locale.',
    'Return ONLY a valid JSON object mapping field names to translated strings.',
    'Preserve meaning, numbers, units, and brand names. Do not invent product facts.',
    'If a field value is null, return null for that field.',
  ].join(' ');
}

export function buildTranslationUserPrompt(input: {
  sourceLocale: string;
  targetLocale: string;
  fields: Record<string, string | null>;
}): string {
  return JSON.stringify({
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
    fields: input.fields,
  });
}

export function parseTranslationPayload(
  text: string,
  fieldKeys: string[],
): Record<string, string | null> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('TRANSLATION_PARSE_ERROR');
  const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const out: Record<string, string | null> = {};
  for (const key of fieldKeys) {
    const v = parsed[key];
    if (v == null) out[key] = null;
    else if (typeof v === 'string') out[key] = v;
    else out[key] = String(v);
  }
  return out;
}
