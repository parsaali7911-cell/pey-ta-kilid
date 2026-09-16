export class ErpSyncDeferredError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs = 5_000,
  ) {
    super(message);
    this.name = 'ErpSyncDeferredError';
  }
}

const SECRET_PATTERNS = [
  /api_key[=:]\s*\S+/gi,
  /api_secret[=:]\s*\S+/gi,
  /authorization[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
  /password[=:]\s*\S+/gi,
];

export function sanitizeErpError(message: string): string {
  let out = message
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('at ') && !t.startsWith('Traceback');
    })
    .join(' ')
    .trim();
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out.replace(/\s{2,}/g, ' ').trim().slice(0, 300);
}

export function erpItemCode(publicId: string): string {
  return `PK-${publicId.slice(0, 12)}`;
}

export function erpRecordIdFromResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as { externalId?: string; name?: string };
  return r.externalId ?? r.name ?? null;
}

export const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000];
