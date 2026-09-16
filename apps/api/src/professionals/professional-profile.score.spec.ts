import {
  computeProfessionalProfileScore,
  isValidIranianNationalId,
  normalizeIranMobile,
} from './professional-profile.score';

describe('professional profile score & identity helpers', () => {
  it('validates Iranian national ID checksum', () => {
    expect(isValidIranianNationalId('0123456780')).toBe(false);
    expect(isValidIranianNationalId('0000000019')).toBe(true);
    expect(isValidIranianNationalId('1111111111')).toBe(false);
    expect(isValidIranianNationalId('123')).toBe(false);
  });

  it('normalizes Iranian mobiles', () => {
    expect(normalizeIranMobile('09121234567')).toBe('+989121234567');
    expect(normalizeIranMobile('+989121234567')).toBe('+989121234567');
    expect(normalizeIranMobile('9121234567')).toBe('+989121234567');
    expect(normalizeIranMobile('02112345678')).toBeNull();
  });

  it('caps completeness score at 100 and requires identity trio', () => {
    const full = computeProfessionalProfileScore({
      hasDisplayName: true,
      hasSpecialty: true,
      hasCity: true,
      mobileVerified: true,
      hasNationalId: true,
      hasAvatar: true,
      bioLength: 40,
      yearsExperience: 8,
      secondarySpecialtyCount: 3,
      portfolioCount: 3,
      hasServiceRadius: true,
      hasPriceInfo: true,
    });
    expect(full.score).toBe(100);
    expect(full.identityReady).toBe(true);

    const weak = computeProfessionalProfileScore({
      hasDisplayName: true,
      hasSpecialty: true,
      hasCity: true,
      mobileVerified: false,
      hasNationalId: false,
      hasAvatar: false,
      bioLength: 0,
      yearsExperience: null,
      secondarySpecialtyCount: 0,
      portfolioCount: 0,
      hasServiceRadius: false,
      hasPriceInfo: false,
    });
    expect(weak.score).toBe(15);
    expect(weak.identityReady).toBe(false);
  });
});
