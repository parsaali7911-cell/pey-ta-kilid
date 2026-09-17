'use client';

import { useMemo, useState } from 'react';
import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import type { Locale } from '@/lib/i18n-public';

type Mode = 'auto' | 'buy' | 'sell' | 'pro';

const EXAMPLES: Record<Locale, Record<Exclude<Mode, 'auto'>, string[]>> = {
  fa: {
    buy: [
      'سرامیک کف ۸۰ برای ویلا در کرج',
      'کابینت هایگلاس آشپزخانه تهران',
      'میلگرد ۱۴ برای اسکلت در اصفهان',
    ],
    sell: [
      'می‌خواهم سرامیک بفروشم از انبار تهران',
      'فروشنده شیرآلات هستم در شیراز',
      'کابینت‌ساز کارخانه دارم — ثبت کالا',
    ],
    pro: [
      'برق‌کار هستم در کرج',
      'نقاش ساختمان اطراف قشم',
      'دنبال سرامیک‌کار در رشت هستم',
    ],
  },
  en: {
    buy: [
      'Floor tile 80cm for a villa in Karaj',
      'High-gloss kitchen cabinets in Tehran',
      'Rebar 14 for structure in Isfahan',
    ],
    sell: [
      'I want to sell ceramic from Tehran warehouse',
      'I sell faucets in Shiraz',
      'Cabinet factory — list products',
    ],
    pro: [
      'I am an electrician in Karaj',
      'Building painter near Qeshm',
      'Looking for a tiler in Rasht',
    ],
  },
  ar: {
    buy: ['بلاط أرضية للفيلا في كرج', 'خزائن مطبخ في طهران'],
    sell: ['أريد بيع السيراميك من مستودع طهران'],
    pro: ['أنا كهربائي في كرج', 'أبحث عن بلاط في رشت'],
  },
};

/**
 * Home = AI demand composer (ChatGPT / Material Bank search-first).
 * Understands buy / sell / pro and routes; catalog lives elsewhere.
 */
export function MarketplaceHero({
  copy,
  locale,
}: {
  copy: Record<string, string>;
  locale: Locale;
  spotlight?: unknown;
}) {
  const [mode, setMode] = useState<Mode>('auto');
  const examples = useMemo(() => {
    const pack = EXAMPLES[locale] || EXAMPLES.fa;
    if (mode === 'auto') return [...pack.buy.slice(0, 2), pack.sell[0], pack.pro[0]];
    return pack[mode];
  }, [locale, mode]);

  const placeholder = useMemo(() => {
    if (mode === 'buy') return copy.search_placeholder_buy || copy.search_placeholder;
    if (mode === 'sell') return copy.search_placeholder_sell || copy.search_placeholder;
    if (mode === 'pro') return copy.search_placeholder_pro || copy.search_placeholder;
    return copy.search_placeholder;
  }, [copy, mode]);

  const modes: Array<{ id: Mode; label: string }> = [
    { id: 'auto', label: copy.mp_mode_auto },
    { id: 'buy', label: copy.mp_mode_buy },
    { id: 'sell', label: copy.mp_mode_sell },
    { id: 'pro', label: copy.mp_mode_pro },
  ];

  return (
    <section className="ai-hero" aria-labelledby="ai-hero-title">
      <div className="ai-hero__orb ai-hero__orb--a" aria-hidden />
      <div className="ai-hero__orb ai-hero__orb--b" aria-hidden />

      <div className="ai-hero__inner">
        <p className="ai-hero__kicker">{copy.mp_kicker}</p>
        <h1 id="ai-hero-title" className="ai-hero__title">
          {copy.mp_hero_title}
        </h1>
        <p className="ai-hero__sub">{copy.mp_hero_sub}</p>

        <div className="ai-hero__modes" role="tablist" aria-label={copy.mp_modes_label}>
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`ai-hero__mode${mode === m.id ? ' is-active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="ai-hero__composer">
          <SiteSearchBar
            locale={locale}
            copy={copy}
            variant="hero"
            showRecent
            alwaysShowSuggestions
            placeholder={placeholder}
            suggestions={examples}
          />
          <p className="ai-hero__understand">{copy.mp_hero_understand}</p>
        </div>

        <div className="ai-hero__quick" aria-label={copy.mp_quick_label}>
          <a className="ai-hero__quick-link" href={`/${locale}/catalog`}>
            {copy.mp_quick_catalog}
          </a>
          <a className="ai-hero__quick-link" href={`/${locale}/professionals`}>
            {copy.mp_quick_pros}
          </a>
          <a className="ai-hero__quick-link" href={`/${locale}/register?intent=seller`}>
            {copy.mp_quick_sell}
          </a>
        </div>
      </div>
    </section>
  );
}
