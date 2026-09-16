'use client';

import { LOCALES, type Locale } from '@/lib/i18n-public';

const LABELS: Record<Locale, string> = {
  fa: 'فارسی',
  en: 'English',
  ar: 'العربية',
};

/** Public translation UX — switch locale for the same path (localized listing content). */
export function LocaleAlternatesBar({
  locale,
  pathWithoutLocale,
  copy,
}: {
  locale: Locale;
  /** Path after locale, e.g. `/catalog/slug` */
  pathWithoutLocale: string;
  copy: Record<string, string>;
}) {
  const rest = pathWithoutLocale.startsWith('/') ? pathWithoutLocale : `/${pathWithoutLocale}`;

  return (
    <div className="pk-locale-bar" role="navigation" aria-label={copy.translate_bar_label}>
      <span className="pk-locale-bar__label">{copy.translate_bar_label}</span>
      <div className="pk-locale-bar__links">
        {LOCALES.map((code) => (
          <a
            key={code}
            href={`/${code}${rest}`}
            className={code === locale ? 'is-active' : undefined}
            hrefLang={code}
            onClick={() => {
              document.cookie = `peytakilid_locale=${code};path=/;max-age=31536000`;
            }}
          >
            {LABELS[code]}
          </a>
        ))}
      </div>
      <p className="pk-locale-bar__hint">{copy.translate_bar_hint}</p>
    </div>
  );
}
