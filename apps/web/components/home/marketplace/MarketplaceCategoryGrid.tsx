import type { Locale } from '@/lib/i18n-public';

export type HomeCategory = {
  slug: string;
  name: string;
  tone: string;
};

/** Visual tones for category tiles (original palette — not copied from Material Bank). */
const TONE_BY_SLUG: Record<string, string> = {
  'ceramic-tile': 'warm',
  'porcelain-tile': 'warm',
  'natural-stone': 'stone',
  'laminate-flooring': 'wood',
  cabinets: 'wood',
  'wood-timber': 'wood',
  doors: 'wood',
  windows: 'glass',
  'glass-mirrors': 'glass',
  'paint-coatings': 'paint',
  'gypsum-plaster': 'neutral',
  insulation: 'neutral',
  waterproofing: 'teal',
  'cement-concrete': 'concrete',
  'steel-rebar': 'metal',
  'brick-block': 'brick',
  'electrical-supplies': 'electric',
  lighting: 'electric',
  hvac: 'teal',
  'pipes-fittings': 'teal',
  sanitaryware: 'glass',
  'faucets-fixtures': 'metal',
  scaffolding: 'metal',
  'landscape-garden': 'green',
};

const PRIORITY = [
  'ceramic-tile',
  'cabinets',
  'natural-stone',
  'steel-rebar',
  'paint-coatings',
  'doors',
  'windows',
  'cement-concrete',
  'electrical-supplies',
  'sanitaryware',
  'wood-timber',
  'porcelain-tile',
];

/**
 * Material-Bank-inspired category mosaic: large visual tiles → catalog filter.
 * Original layout/copy — pattern only (browse materials by category).
 */
export function MarketplaceCategoryGrid({
  locale,
  copy,
  categories,
}: {
  locale: Locale;
  copy: Record<string, string>;
  categories: HomeCategory[];
}) {
  const ranked = [...categories].sort((a, b) => {
    const ia = PRIORITY.indexOf(a.slug);
    const ib = PRIORITY.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const tiles = ranked.slice(0, 12).map((c) => ({
    ...c,
    tone: TONE_BY_SLUG[c.slug] || c.tone || 'neutral',
  }));

  if (!tiles.length) return null;

  return (
    <section className="mb-cats" aria-labelledby="mb-cats-title">
      <div className="mb-cats__inner">
        <div className="mb-cats__head">
          <h2 id="mb-cats-title" className="mp-section-title">
            {copy.mp_cats_title}
          </h2>
          {copy.mp_cats_lead ? <p className="mp-section-lead">{copy.mp_cats_lead}</p> : null}
        </div>
        <div className="mb-cats__grid">
          {tiles.map((c, i) => (
            <a
              key={c.slug}
              className={`mb-cat mb-cat--${c.tone}${i === 0 ? ' mb-cat--wide' : ''}`}
              href={`/${locale}/catalog?category=${encodeURIComponent(c.slug)}`}
            >
              <span className="mb-cat__label">{c.name}</span>
              <span className="mb-cat__go" aria-hidden>
                →
              </span>
            </a>
          ))}
        </div>
        <div className="mb-cats__foot">
          <a className="mp-btn" href={`/${locale}/catalog`}>
            {copy.mp_cats_all}
          </a>
        </div>
      </div>
    </section>
  );
}
