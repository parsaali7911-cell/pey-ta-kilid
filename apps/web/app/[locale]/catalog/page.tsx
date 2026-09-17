import { notFound } from 'next/navigation';
import { MarketplaceListingCard } from '@/components/home/marketplace/MarketplaceListingCard';
import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import { apiGet } from '@/lib/api';
import { isLocale, t, type Locale } from '@/lib/i18n-public';

export const dynamic = 'force-dynamic';

type PublicListing = {
  slug: string;
  title: string;
  uomCode?: string | null;
  price?: { displayPrice?: number | null; currency?: string | null } | null;
  category?: {
    slug?: string | null;
    name?: string | null;
    nameEn?: string | null;
    nameFa?: string | null;
    nameAr?: string | null;
  } | null;
  organization?: { name?: string | null } | null;
  media?: Array<{ url?: string | null; status?: string | null }>;
};

type CategoryRow = {
  slug: string;
  name?: string;
  nameEn?: string;
  nameFa?: string;
};

function categoryName(listing: PublicListing, locale: Locale) {
  if (locale === 'fa') {
    return listing.category?.nameFa || listing.category?.name || listing.category?.nameEn || null;
  }
  if (locale === 'ar') {
    return listing.category?.nameAr || listing.category?.name || listing.category?.nameEn || null;
  }
  return listing.category?.nameEn || listing.category?.name || null;
}

function catLabel(c: CategoryRow, locale: Locale) {
  if (locale === 'fa') return c.nameFa || c.name || c.slug;
  return c.nameEn || c.name || c.slug;
}

/** Material Bank–style catalog: light chrome, chips, dense mobile cards. */
export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const sp = await searchParams;
  const categorySlug = (sp.category || '').trim();
  const copy = t(locale);
  const [listings, categories] = await Promise.all([
    apiGet<PublicListing[]>(`/catalog/listings?locale=${encodeURIComponent(locale)}`),
    apiGet<CategoryRow[]>(`/categories?locale=${encodeURIComponent(locale)}`),
  ]);

  const all = listings || [];
  const cats = (categories || []).slice(0, 16);
  const filtered = categorySlug
    ? all.filter((l) => (l.category?.slug || '').toLowerCase() === categorySlug.toLowerCase())
    : all;
  const activeCat = cats.find((c) => c.slug === categorySlug);
  const heading = categorySlug
    ? catLabel(activeCat || { slug: categorySlug }, locale)
    : copy.catalog_title;

  return (
    <div className="pk-browse">
      <div className="pk-browse__head">
        <div className="pk-browse__titles">
          <p className="pk-browse__kicker">{copy.mp_cats_title}</p>
          <h1 className="pk-browse__title">{heading}</h1>
          <p className="pk-browse__lead">
            {filtered.length} · {copy.catalog_lead}
          </p>
        </div>
        <div className="pk-browse__search">
          <SiteSearchBar locale={locale} copy={copy} variant="inline" />
        </div>
      </div>

      {cats.length ? (
        <div className="pk-browse__chips" aria-label={copy.mp_cats_title}>
          <a
            className={`pk-browse__chip${!categorySlug ? ' is-active' : ''}`}
            href={`/${locale}/catalog`}
          >
            {copy.mp_cats_all}
          </a>
          {cats.map((c) => (
            <a
              key={c.slug}
              className={`pk-browse__chip${categorySlug === c.slug ? ' is-active' : ''}`}
              href={`/${locale}/catalog?category=${encodeURIComponent(c.slug)}`}
            >
              {catLabel(c, locale)}
            </a>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="pk-empty">{copy.no_results}</div>
      ) : (
        <div className="pk-catalog-grid pk-browse__grid">
          {filtered.map((listing) => {
            const media = (listing.media || []).find(
              (m) => m.url && (!m.status || m.status === 'APPROVED'),
            );
            return (
              <MarketplaceListingCard
                key={listing.slug}
                locale={locale}
                copy={copy}
                showDesignCta={false}
                listing={{
                  slug: listing.slug,
                  title: listing.title,
                  categoryName: categoryName(listing, locale),
                  sellerName: listing.organization?.name,
                  displayPrice: listing.price?.displayPrice,
                  currency: listing.price?.currency,
                  uomCode: listing.uomCode,
                  imageUrl: media?.url || null,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
