import {
  detectChatLanguage,
  isPersianLocale,
  normalizeChatLocale,
} from './listing-chat.i18n';

describe('listing chat i18n', () => {
  it('normalizes locale codes', () => {
    expect(normalizeChatLocale('EN-US')).toBe('en');
    expect(normalizeChatLocale('fa_IR')).toBe('fa');
    expect(normalizeChatLocale('ar')).toBe('ar');
  });

  it('detects Persian vs English vs Arabic', () => {
    expect(detectChatLanguage('قیمت این سرامیک چقدر است؟')).toBe('fa');
    expect(detectChatLanguage('What is the price for 60x60 tiles?')).toBe('en');
    expect(detectChatLanguage('ما هو السعر؟', 'ar')).toBe('ar');
  });

  it('uses page locale hint for Latin script', () => {
    expect(detectChatLanguage('Need MOQ and lead time', 'de')).toBe('de');
    expect(detectChatLanguage('Need MOQ and lead time', 'fa')).toBe('en');
  });

  it('knows Persian locale', () => {
    expect(isPersianLocale('fa')).toBe(true);
    expect(isPersianLocale('en')).toBe(false);
  });
});
