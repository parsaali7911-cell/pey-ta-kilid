import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/i18n-public';

export type MarketplaceListingCardData = {
  slug: string;
  title: string;
  categoryName?: string | null;
  sellerName?: string | null;
  displayPrice?: number | null;
  currency?: string | null;
  uomCode?: string | null;
  imageUrl?: string | null;
  city?: string | null;
};

/**
 * Mobile-first product card (Digikala / Airbnb / Material Bank patterns):
 * square image → title 2 lines → price bold → city/seller one line.
 */
function fallbackTone(seed: string) {
  const tones = [
    'pk-card__fallback--warm',
    'pk-card__fallback--stone',
    'pk-card__fallback--teal',
    'pk-card__fallback--sand',
    'pk-card__fallback--clay',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h + seed.charCodeAt(i) * (i + 1)) % 997;
  return tones[h % tones.length];
}

export function MarketplaceListingCard({
  listing,
  locale,
  copy,
  badge,
  showDesignCta = false,
}: {
  listing: MarketplaceListingCardData;
  locale: Locale;
  copy: Record<string, string>;
  badge?: string;
  showDesignCta?: boolean;
}) {
  const hasPrice = listing.displayPrice != null && Number(listing.displayPrice) > 0;
  const priceLabel = hasPrice
    ? formatMoney(listing.displayPrice, listing.currency, locale)
    : copy.mp_price_rfq;
  const meta = [listing.city, listing.categoryName || listing.sellerName].filter(Boolean).join(' · ');
  const tone = fallbackTone(listing.slug || listing.title || 'x');

  return (
    <article className="pk-card">
      <a className="pk-card__link" href={`/${locale}/catalog/${listing.slug}`}>
        <div className="pk-card__media">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imageUrl} alt={listing.title} loading="lazy" />
          ) : (
            <div className={`pk-card__fallback ${tone}`} aria-hidden>
              <span className="pk-card__fallback-mark">
                {(listing.categoryName || listing.title || '·').slice(0, 1)}
              </span>
              {listing.categoryName ? (
                <span className="pk-card__fallback-cat">{listing.categoryName}</span>
              ) : null}
            </div>
          )}
          {badge ? <span className="pk-card__badge">{badge}</span> : null}
        </div>
        <div className="pk-card__body">
          <h3 className="pk-card__title">{listing.title}</h3>
          {meta ? <p className="pk-card__meta">{meta}</p> : null}
          <p className="pk-card__price">
            {hasPrice ? (
              <>
                <span className="pk-card__price-val">{priceLabel}</span>
                {listing.uomCode ? <span className="pk-card__uom">/{listing.uomCode}</span> : null}
              </>
            ) : (
              <span className="pk-card__price-val pk-card__price-val--rfq">{priceLabel}</span>
            )}
          </p>
        </div>
      </a>
      {showDesignCta ? (
        <a
          className="pk-card__extra"
          href={`/${locale}/designer?listing=${encodeURIComponent(listing.slug)}`}
        >
          {copy.mp_try_design || copy.listing_try_design}
        </a>
      ) : null}
    </article>
  );
}
