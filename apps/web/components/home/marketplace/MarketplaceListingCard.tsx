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
};

export function MarketplaceListingCard({
  listing,
  locale,
  copy,
  badge,
}: {
  listing: MarketplaceListingCardData & { city?: string | null };
  locale: Locale;
  copy: Record<string, string>;
  badge?: string;
}) {
  const hasPrice = listing.displayPrice != null && Number(listing.displayPrice) > 0;
  const priceLabel = hasPrice
    ? `${copy.mp_from} ${formatMoney(listing.displayPrice, listing.currency, locale)}${
        listing.uomCode ? ` / ${listing.uomCode}` : ''
      }`
    : copy.mp_price_rfq;

  return (
    <article className="mp-stone-card">
      <a className="mp-stone-card__link" href={`/${locale}/catalog/${listing.slug}`}>
        <div className="mp-stone-card__media">
          {listing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.imageUrl} alt={listing.title} loading="lazy" />
          ) : (
            <div className="mp-stone-card__fallback" />
          )}
          {badge ? <span className="mp-stone-card__badge">{badge}</span> : null}
        </div>
        <div className="mp-stone-card__body">
          <h3 className="mp-stone-card__name">{listing.title}</h3>
          <p className="mp-stone-card__meta">
            {[listing.categoryName, listing.sellerName, listing.city].filter(Boolean).join(' · ')}
          </p>
          <p className="mp-stone-card__price">{priceLabel}</p>
          {hasPrice ? <p className="mp-stone-card__price-note">{copy.mp_price_includes_margin}</p> : null}
          <span className="mp-cta-line">
            {copy.mp_view_listing} <span aria-hidden>→</span>
          </span>
        </div>
      </a>
    </article>
  );
}
