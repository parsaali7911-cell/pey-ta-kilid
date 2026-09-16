'use client';

import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import type { Locale } from '@/lib/i18n-public';

const SHORTCUTS = [
  { id: 'ceramic', q: { fa: 'سرامیک کف ۲۰۰ متر', en: '200 m2 floor ceramic', ar: 'سيراميك أرضيات 200 م2' } },
  { id: 'stone', q: { fa: 'سنگ سفید لابی ۸۰۰ متر', en: 'white stone lobby 800 m2', ar: 'حجر أبيض للبهو 800 م2' } },
  { id: 'cabinet', q: { fa: 'کابینت‌ساز در تهران', en: 'cabinet maker in Tehran', ar: 'صانع خزائن في طهران' } },
];

export function MarketplaceDiscovery({
  locale,
  copy,
}: {
  locale: Locale;
  copy: Record<string, string>;
}) {
  return (
    <section className="mp-discovery" aria-labelledby="mp-discovery-title">
      <div className="mp-discovery__inner">
        <h2 id="mp-discovery-title" className="mp-discovery__title">
          {copy.mp_discovery_title}
        </h2>
        {copy.mp_discovery_lead ? (
          <p className="mp-discovery__lead">{copy.mp_discovery_lead}</p>
        ) : null}

        <SiteSearchBar locale={locale} copy={copy} variant="inline" showRecent />

        <div className="mp-quick-filters">
          <p className="mp-quick-filters__label">{copy.search_recent}</p>
          <div className="mp-chip-row">
            {SHORTCUTS.map((s) => {
              const text = s.q[locale] || s.q.fa;
              return (
                <a
                  key={s.id}
                  className="mp-chip"
                  href={`/${locale}/search?q=${encodeURIComponent(text)}`}
                >
                  {text}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
