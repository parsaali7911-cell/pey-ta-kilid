import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import type { Locale } from '@/lib/i18n-public';

const EXAMPLE_PROMPTS_FA = [
  'درب چوبی توی کرج با کمترین قیمت',
  'نصاب کاشی در رشت',
  'می‌خواهم سرامیک کف بفروشم در تهران',
  'متخصص کابینت در اصفهان',
];

const EXAMPLE_PROMPTS_EN = [
  'Wooden doors in Karaj at the lowest price',
  'Tile installer in Rasht',
  'I want to sell floor ceramic in Tehran',
  'Cabinet maker in Isfahan',
];

/**
 * Stylish search-first hero — one prompt for buyer / seller / professional.
 * Photo + voice live inside SiteSearchBar.
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

        <ul className="mp-hero__journeys" aria-label={copy.mp_journey_label}>
          <li>
            <span className="mp-hero__journey-dot" aria-hidden />
            {copy.mp_journey_buy}
          </li>
          <li>
            <span className="mp-hero__journey-dot" aria-hidden />
            {copy.mp_journey_sell}
          </li>
          <li>
            <span className="mp-hero__journey-dot" aria-hidden />
            {copy.mp_journey_pro}
          </li>
        </ul>

        <p className="mp-hero__pricing-note">{copy.mp_pricing_note}</p>
      </div>
    </section>
  );
}
