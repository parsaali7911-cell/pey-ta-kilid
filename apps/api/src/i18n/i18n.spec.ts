import {
  INCOTERM_CODES,
  MarketCode,
  PriceType,
  resolveLocalizedValue,
  isRtlLocale,
  SUPPORTED_CURRENCY_CODES,
} from '@peytakilid/shared-types';

describe('i18n + market foundations', () => {
  it('resolves localized fields with fallback chain', () => {
    expect(
      resolveLocalizedValue({
        locale: 'fa',
        translations: { en: 'Tile', fa: 'کاشی' },
        fallback: 'fallback',
      }),
    ).toBe('کاشی');
    expect(
      resolveLocalizedValue({
        locale: 'ar',
        translations: { en: 'Tile' },
        fallback: 'fallback',
      }),
    ).toBe('Tile');
  });

  it('marks fa/ar as RTL', () => {
    expect(isRtlLocale('fa')).toBe(true);
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('en')).toBe(false);
  });

  it('keeps market codes independent from locales/currencies', () => {
    expect(MarketCode.IRAN).toBe('IRAN');
    expect(MarketCode.INTERNATIONAL).toBe('INTERNATIONAL');
    expect(SUPPORTED_CURRENCY_CODES).toEqual(
      expect.arrayContaining(['IRR', 'USD', 'EUR', 'AED']),
    );
    expect(INCOTERM_CODES).toEqual(
      expect.arrayContaining([PriceType.EXW, PriceType.FOB, PriceType.CIF]),
    );
  });
});
