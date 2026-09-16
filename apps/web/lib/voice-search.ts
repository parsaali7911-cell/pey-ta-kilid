import { apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';

export type VoiceTranscribeResult = {
  query: string;
  transcript: string;
  language?: string;
  model?: string;
  provider?: string;
};

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function browserSpeechRecognition(locale: Locale): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      reject(new Error('BROWSER_SPEECH_UNAVAILABLE'));
      return;
    }
    const lang = locale === 'fa' ? 'fa-IR' : locale === 'ar' ? 'ar-SA' : 'en-US';
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript?.trim();
      if (text) resolve(text);
      else reject(new Error('EMPTY_TRANSCRIPT'));
    };
    rec.onerror = (ev) => reject(new Error(ev.error || 'SPEECH_ERROR'));
    rec.onend = () => undefined;
    rec.start();
  });
}

export async function transcribeVoiceBlob(blob: Blob, locale: Locale): Promise<VoiceTranscribeResult> {
  const form = new FormData();
  form.append('file', blob, blob.type.includes('mp4') ? 'voice.m4a' : 'voice.webm');
  form.append('locale', locale);
  const res = await fetch(apiUrl('/search/voice'), { method: 'POST', body: form });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok && typeof json.query === 'string') {
    return json as unknown as VoiceTranscribeResult;
  }
  const code = typeof json.code === 'string' ? json.code : '';
  if (res.status === 503 || code === 'PROVIDER_NOT_CONFIGURED' || code === 'REQUIRES_CREDENTIAL') {
    throw new Error('OPENAI_NOT_CONFIGURED');
  }
  throw new Error(typeof json.message === 'string' ? json.message : 'Voice search failed');
}

export async function transcribeVoiceWithFallback(
  blob: Blob,
  locale: Locale,
): Promise<VoiceTranscribeResult> {
  try {
    return await transcribeVoiceBlob(blob, locale);
  } catch (err) {
    if (!(err instanceof Error) || err.message !== 'OPENAI_NOT_CONFIGURED') throw err;
    const text = await browserSpeechRecognition(locale);
    return { query: text, transcript: text, provider: 'browser' };
  }
}
