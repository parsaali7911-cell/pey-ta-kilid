import { BUILTIN_LOCALES, isRtlLocale, localeDirection } from '@peytakilid/shared-types';

export type WebLocaleMeta = {
  code: string;
  dir: 'rtl' | 'ltr';
  isDefault: boolean;
};

export function getDefaultLocaleCode(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'fa';
}

export function getLocaleMeta(code?: string): WebLocaleMeta {
  const requested = (code || getDefaultLocaleCode()).toLowerCase();
  const builtin = BUILTIN_LOCALES.find((l) => l.code === requested) || BUILTIN_LOCALES[0];
  return {
    code: builtin.code,
    dir: isRtlLocale(builtin.code) ? 'rtl' : 'ltr',
    isDefault: builtin.isDefault,
  };
}

export function listBuiltinLocales(): WebLocaleMeta[] {
  return BUILTIN_LOCALES.map((l) => ({
    code: l.code,
    dir: localeDirection(l.code) === 'RTL' ? 'rtl' : 'ltr',
    isDefault: l.isDefault,
  }));
}
