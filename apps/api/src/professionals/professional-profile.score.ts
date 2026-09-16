import { createHash } from 'crypto';

export type ProScoreInput = {
  hasDisplayName: boolean;
  hasSpecialty: boolean;
  hasCity: boolean;
  mobileVerified: boolean;
  hasNationalId: boolean;
  hasAvatar: boolean;
  bioLength: number;
  yearsExperience: number | null;
  secondarySpecialtyCount: number;
  portfolioCount: number;
  hasServiceRadius: boolean;
  hasPriceInfo: boolean;
};

/** Deterministic profile completeness + identity score (0–100). */
export function computeProfessionalProfileScore(input: ProScoreInput): {
  score: number;
  breakdown: Record<string, number>;
  identityReady: boolean;
} {
  const breakdown: Record<string, number> = {
    mobileVerified: input.mobileVerified ? 20 : 0,
    nationalId: input.hasNationalId ? 15 : 0,
    avatar: input.hasAvatar ? 15 : 0,
    displayName: input.hasDisplayName ? 5 : 0,
    specialty: input.hasSpecialty ? 5 : 0,
    city: input.hasCity ? 5 : 0,
    bio: input.bioLength >= 20 ? 10 : input.bioLength > 0 ? 4 : 0,
    yearsExperience: input.yearsExperience != null && input.yearsExperience >= 0 ? 5 : 0,
    secondarySpecialties: Math.min(5, input.secondarySpecialtyCount * 2),
    portfolio: input.portfolioCount >= 2 ? 10 : input.portfolioCount === 1 ? 5 : 0,
    serviceRadius: input.hasServiceRadius ? 5 : 0,
    priceInfo: input.hasPriceInfo ? 5 : 0,
  };

  const score = Math.min(
    100,
    Object.values(breakdown).reduce((a, b) => a + b, 0),
  );

  return {
    score,
    breakdown,
    identityReady: Boolean(input.mobileVerified && input.hasNationalId && input.hasAvatar),
  };
}

export function normalizeIranMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  let phone = digits;
  if (phone.startsWith('0098')) phone = phone.slice(4);
  if (phone.startsWith('98') && phone.length === 12) phone = phone.slice(2);
  if (phone.startsWith('0') && phone.length === 11) phone = phone.slice(1);
  if (!/^9\d{9}$/.test(phone)) return null;
  return `+98${phone}`;
}

/** Iranian national ID (کد ملی) checksum. */
export function isValidIranianNationalId(code: string): boolean {
  const id = code.replace(/\D/g, '');
  if (!/^\d{10}$/.test(id)) return false;
  if (/^(\d)\1{9}$/.test(id)) return false;
  const check = Number(id[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(id[i]) * (10 - i);
  const r = sum % 11;
  return r < 2 ? check === r : check === 11 - r;
}

export function hashNationalId(nationalId: string): string {
  return createHash('sha256').update(`peytakilid:nid:${nationalId}`).digest('hex');
}

export function hashOtpCode(code: string, phone: string): string {
  return createHash('sha256').update(`peytakilid:otp:${phone}:${code}`).digest('hex');
}

export function slugifyProName(name: string, fallback = 'pro'): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06FF]+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  // Persian-only names leave digits/empty — prefer stable fallback.
  if (!base || /^\d+$/.test(base)) return fallback;
  return base;
}
