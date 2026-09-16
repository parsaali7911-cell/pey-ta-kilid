const DEFAULT_API = 'http://127.0.0.1:4000';

/** Browser calls go through Next rewrite `/api/*`. RSC can use internal API URL. */
export function apiUrl(path: string, opts?: { internal?: boolean }): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const withApi = clean.startsWith('/api/') ? clean : `/api${clean}`;
  if (opts?.internal || typeof window === 'undefined') {
    const base = (process.env.API_INTERNAL_URL || DEFAULT_API).replace(/\/$/, '');
    return `${base}${withApi}`;
  }
  return withApi;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(apiUrl(path, { internal: true }), {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers || {}) },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function apiPostClient<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const SEARCH_QUERY_STORAGE_KEY = 'peytakilid:lastSearchQuery';
export const SEARCH_TEXT_STORAGE_KEY = 'peytakilid:lastNeedText';
