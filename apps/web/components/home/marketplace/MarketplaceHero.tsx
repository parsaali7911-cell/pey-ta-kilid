'use client';

import { useMemo } from 'react';
import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import type { Locale } from '@/lib/i18n-public';

/** Mixed examples — intent is inferred from the text (no mode tabs). */
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
 * ChatGPT-style home: one short prompt + composer. No modes, no essays.
 * Buy / sell / pro is understood from what the user writes.
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
    <section className="ai-hero ai-hero--gpt" aria-labelledby="ai-hero-title">
      <div className="ai-hero__inner">
        <h1 id="ai-hero-title" className="ai-hero__title">
          {copy.mp_hero_title}
        </h1>

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
