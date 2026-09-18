import { apiUrl } from '@/lib/api';

const ACCESS_KEY = 'peytakilid:accessToken';
const REFRESH_KEY = 'peytakilid:refreshToken';

export type AuthUser = {
  id: string;
  email: string;
  fullName?: string | null;
  platformRole: string;
  memberships: Array<{
    orgRole: string;
    organization: { id: string; name: string; slug: string; canSell?: boolean; canBuy?: boolean; isProfessional?: boolean };
  }>;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
};

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function saveTokens(tokens: TokenPair) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function apiAuthPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatApiError(json, res.status));
  }
  return json as T;
}

export async function apiAuthed<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error('UNAUTHORIZED');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...(init?.headers as Record<string, string> | undefined),
  };

  let body = init?.body;
  if (init?.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }

  let res = await fetch(apiUrl(path), { ...init, headers, body });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      clearTokens();
      throw new Error('UNAUTHORIZED');
    }
    headers.Authorization = `Bearer ${getAccessToken()}`;
    res = await fetch(apiUrl(path), { ...init, headers, body });
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(json, res.status));
  return json as T;
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiAuthedForm<T>(path: string, form: FormData): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error('UNAUTHORIZED');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  let res = await fetch(apiUrl(path), { method: 'POST', headers, body: form });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      clearTokens();
      throw new Error('UNAUTHORIZED');
    }
    headers.Authorization = `Bearer ${getAccessToken()}`;
    res = await fetch(apiUrl(path), { method: 'POST', headers, body: form });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(formatApiError(json, res.status));
  return json as T;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const tokens = await apiAuthPost<TokenPair>('/auth/refresh', { refreshToken });
    saveTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

export async function fetchMe(): Promise<AuthUser> {
  return apiAuthed<AuthUser>('/auth/me');
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const tokens = await apiAuthPost<TokenPair>('/auth/login', { email, password });
  saveTokens(tokens);
  return tokens;
}

export async function register(input: {
  email: string;
  password: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  nationalId?: string;
}): Promise<TokenPair> {
  const tokens = await apiAuthPost<TokenPair>('/auth/register', input);
  saveTokens(tokens);
  return tokens;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) await apiAuthPost('/auth/logout', { refreshToken });
  } catch {
    /* ignore */
  }
  clearTokens();
}

function formatApiError(json: unknown, status: number): string {
  if (json && typeof json === 'object') {
    const j = json as { message?: string | string[]; code?: string };
    if (Array.isArray(j.message)) return j.message.join(', ');
    if (typeof j.message === 'string') return j.message;
  }
  return `Request failed (${status})`;
}
