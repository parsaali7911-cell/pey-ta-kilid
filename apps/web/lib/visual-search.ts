import { apiUrl } from '@/lib/api';

export const VISUAL_SEARCH_STORAGE_KEY = 'peytakilid_visual_search';

export type VisualSearchHit = {
  listingId: string;
  score?: number;
  slug?: string;
  title?: string;
  displayPrice?: number | null;
  currency?: string | null;
  uomCode?: string | null;
  matchedColor?: string | null;
  category?: { name?: string | null } | null;
  organizationPublic?: { name?: string | null } | null;
  coverImageUrl?: string | null;
};

export type VisualSearchPayload = {
  hex: string | null;
  tone?: string | null;
  caption?: string | null;
  previewDataUrl?: string | null;
  city?: string | null;
  categorySlug?: string | null;
  results: VisualSearchHit[];
  matchCount: number;
  at: number;
};

export function saveVisualSearchPayload(payload: Omit<VisualSearchPayload, 'at'>) {
  if (typeof window === 'undefined') return;
  const full: VisualSearchPayload = { ...payload, at: Date.now() };
  sessionStorage.setItem(VISUAL_SEARCH_STORAGE_KEY, JSON.stringify(full));
}

export function loadVisualSearchPayload(maxAgeMs = 15 * 60 * 1000): VisualSearchPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(VISUAL_SEARCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisualSearchPayload;
    if (!parsed?.at || Date.now() - parsed.at > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Average color from image — sent as clientHex so search works without vision AI. */
export async function extractClientHex(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, size, size);
    bitmap.close();
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
    if (!n) return null;
    const toHex = (v: number) =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return null;
  }
}

export async function uploadVisualSearchImage(
  file: File,
  locale: string,
  userText?: string,
): Promise<VisualSearchPayload> {
  const clientHex = await extractClientHex(file);
  const form = new FormData();
  form.append('file', file);
  form.append('locale', locale);
  if (clientHex) form.append('clientHex', clientHex);
  if (userText?.trim()) form.append('text', userText.trim());

  const res = await fetch(apiUrl('/search/visual'), {
    method: 'POST',
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof json.message === 'string'
        ? json.message
        : Array.isArray(json.message)
          ? json.message.join(', ')
          : 'Visual search failed';
    throw new Error(msg);
  }

  const results = (Array.isArray(json.results) ? json.results : []) as VisualSearchHit[];
  return {
    hex: (json.hex as string | null) ?? clientHex,
    tone: (json.tone as string | null) ?? null,
    caption: (json.caption as string | null) ?? userText?.trim() ?? null,
    previewDataUrl: null,
    city: (json.city as string | null) ?? null,
    categorySlug: (json.categorySlug as string | null) ?? null,
    results,
    matchCount: (json.matchCount as number) ?? results.length,
    at: Date.now(),
  };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}
