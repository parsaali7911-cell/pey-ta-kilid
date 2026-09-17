import { notFound } from 'next/navigation';
import { PublicPageShell } from '@/components/PublicPageShell';
import { MarketplaceListingCard } from '@/components/home/marketplace/MarketplaceListingCard';
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
  if (listing.category?.name) return listing.category.name;
  if (locale === 'fa') return listing.category?.nameFa || listing.category?.nameEn || null;
  if (locale === 'ar') return listing.category?.nameAr || listing.category?.nameEn || null;
  return listing.category?.nameEn || null;
}

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
  const filtered = categorySlug
    ? all.filter((l) => (l.category?.slug || '').toLowerCase() === categorySlug.toLowerCase())
    : all;
  const activeCat = (categories || []).find((c) => c.slug === categorySlug);
  const catTitle =
    locale === 'fa'
      ? activeCat?.nameFa || activeCat?.name || categorySlug
      : activeCat?.nameEn || activeCat?.name || categorySlug;

  return (
    <PublicPageShell
      locale={locale}
      kicker={copy.brand}
      title={categorySlug ? catTitle || copy.catalog_title : copy.catalog_title}
      lead={categorySlug ? copy.catalog_lead : copy.catalog_lead}
      wide
    >
      {categorySlug ? (
        <p className="panel-muted" style={{ marginBottom: '1rem' }}>
          <a href={`/${locale}/catalog`}>{copy.mp_cats_all}</a>
          {' · '}
          {filtered.length} {copy.mp_featured_title}
        </p>
      ) : null}
      {filtered.length === 0 ? (
        <div className="pk-empty">{copy.no_results}</div>
      ) : (
        <div className="mb-featured__grid">
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
    </PublicPageShell>
  );
}
