'use client';

import { useMemo } from 'react';
import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import type { Locale } from '@/lib/i18n-public';

/** Mixed examples — intent inferred from text (no mode tabs). */
const EXAMPLES: Record<Locale, string[]> = {
  fa: [
    'سرامیک کف ۸۰ برای ویلا در کرج',
    'می‌خواهم سرامیک بفروشم از انبار تهران',
    'برق‌کار هستم در کرج',
    'کابینت هایگلاس آشپزخانه تهران',
  ],
  en: [
    'Floor tile 80cm for a villa in Karaj',
    'I want to sell ceramic from Tehran warehouse',
    'I am an electrician in Karaj',
    'High-gloss kitchen cabinets in Tehran',
  ],
  ar: [
    'بلاط أرضية للفيلا في كرج',
    'أريد بيع السيراميك من مستودع طهران',
    'أنا كهربائي في كرج',
  ],
};

/**
 * ChatGPT-style home: brand lockup on top, search under it.
 * Colors follow the industrial peytakilid logo (yellow / charcoal / blue-red).
 */
export function MarketplaceHero({
  copy,
  locale,
}: {
  copy: Record<string, string>;
  locale: Locale;
  spotlight?: unknown;
}) {
  const examples = useMemo(() => EXAMPLES[locale] || EXAMPLES.fa, [locale]);

  return (
    <section className="ai-hero ai-hero--brand" aria-label={copy.brand}>
      <div className="ai-hero__inner">
        <div className="ai-hero__logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/peytakilid-hero.png"
            alt={copy.brand}
            width={420}
            height={560}
            decoding="async"
          />
        </div>

        <h1 className="sr-only">{copy.mp_hero_title}</h1>

        <div className="ai-hero__composer">
          <SiteSearchBar
            locale={locale}
            copy={copy}
            variant="hero"
            showRecent
            alwaysShowSuggestions
            placeholder={copy.search_placeholder}
            suggestions={examples}
          />
        </div>
      </div>
    </section>
  );
}
