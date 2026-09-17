import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import type { Locale } from '@/lib/i18n-public';

/** Optional chips only — any free-form prompt works; these are not required templates. */
const EXAMPLE_PROMPTS_FA = [
  'سرامیک کف برای ویلا در کرج',
  'کابینت آشپزخانه هایگلاس',
  'میلگرد برای اسکلت در تهران',
  'نقاش ساختمان در اصفهان',
];

const EXAMPLE_PROMPTS_EN = [
  'Floor tile for a villa in Karaj',
  'High-gloss kitchen cabinets',
  'Rebar for structure in Tehran',
  'Building painter in Isfahan',
];

/**
 * Stylish search-first hero — one free-form prompt for buyer / seller / professional.
 * Photo + voice live inside SiteSearchBar. Example chips are optional hints only.
 */
export function MarketplaceHero({
  copy,
  locale,
  spotlight,
}: {
  copy: Record<string, string>;
  locale: Locale;
  spotlight?: { title: string; slug: string; category?: string | null; imageUrl?: string | null } | null;
}) {
  const hasSpotlight = Boolean(spotlight?.imageUrl);
  const examples = locale === 'en' ? EXAMPLE_PROMPTS_EN : EXAMPLE_PROMPTS_FA;

  return (
    <section
      className={`mp-hero mp-hero--hub${hasSpotlight ? ' mp-hero--spotlight' : ''}`}
      aria-labelledby="mp-hero-title"
    >
      {hasSpotlight ? (
        <>
          <div
            className="mp-hero__backdrop"
            style={{ backgroundImage: `url(${spotlight!.imageUrl})` }}
            aria-hidden
          />
          <div className="mp-hero__veil" aria-hidden />
        </>
      ) : null}
      <div className="mp-hero__glow mp-hero__glow--gold" aria-hidden />
      <div className="mp-hero__glow mp-hero__glow--teal" aria-hidden />

      <div className="mp-hero__inner mp-hero__inner--hub">
        <p className="mp-kicker">{copy.mp_kicker}</p>
        <h1 id="mp-hero-title" className="mp-hero__title">
          {copy.mp_hero_title}
        </h1>
        <p className="mp-hero__sub">{copy.mp_hero_sub}</p>

        <div className="mp-hero__search mp-hero__search--hub">
          <SiteSearchBar
            locale={locale}
            copy={copy}
            variant="hero"
            showRecent
            suggestions={examples}
          />
        </div>
      </div>
    </section>
  );
}
