import { OrgRole, PlatformRole } from '@peytakilid/shared-types';

describe('shared role enums', () => {
  it('exposes platform and org roles', () => {
    expect(PlatformRole.USER).toBe('USER');
    expect(OrgRole.ORG_OWNER).toBe('ORG_OWNER');
  });
});

describe('auth ttl parser contract', () => {
  function parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    const unit = match[2];
    const mult =
      unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return n * mult;
  }

  it('parses refresh ttl', () => {
    expect(parseTtlMs('7d')).toBe(604800000);
    expect(parseTtlMs('15m')).toBe(900000);
  });
});
