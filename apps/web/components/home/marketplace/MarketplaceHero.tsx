import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import type { Locale } from '@/lib/i18n-public';

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

  return (
    <section
      className={`mp-hero${hasSpotlight ? ' mp-hero--spotlight' : ''}`}
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
          <div className="mp-hero__glow mp-hero__glow--gold" aria-hidden />
          <div className="mp-hero__glow mp-hero__glow--teal" aria-hidden />
        </>
      ) : null}

      <div className="mp-hero__inner">
        <p className="mp-kicker">{copy.mp_kicker}</p>
        <h1 id="mp-hero-title" className="mp-hero__title">
          {copy.mp_hero_title}
        </h1>
        <p className="mp-hero__sub">{copy.mp_hero_sub}</p>

        <div className="mp-hero__search">
          <SiteSearchBar locale={locale} copy={copy} variant="hero" showRecent />
        </div>

        {spotlight ? (
          <div className="mp-hero__spotlight">
            <div className="mp-hero__spotlight-media">
              {spotlight.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={spotlight.imageUrl} alt={spotlight.title} loading="eager" />
              ) : (
                <div className="mp-stone-card__fallback" />
              )}
            </div>
            <div className="mp-hero__spotlight-body">
              {spotlight.category ? (
                <span className="mp-hero__spotlight-tag">{spotlight.category}</span>
              ) : null}
              <strong>{spotlight.title}</strong>
              <a className="mp-btn mp-btn--primary" href={`/${locale}/catalog/${spotlight.slug}`}>
                {copy.mp_hero_cta} →
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
