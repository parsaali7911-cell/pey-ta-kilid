import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { isLocale, t, type Locale } from '@/lib/i18n-public';
import { MarketplaceHero } from '@/components/home/marketplace/MarketplaceHero';
import { MarketplaceCategoryGrid } from '@/components/home/marketplace/MarketplaceCategoryGrid';
import { MarketplaceRoleStrip } from '@/components/home/marketplace/MarketplaceRoleStrip';
import { MarketplaceListingCard } from '@/components/home/marketplace/MarketplaceListingCard';

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
  facility?: { address?: { city?: string | null } | null } | null;
};

type CategoryRow = {
  id: string;
  parentId?: string | null;
  slug: string;
  name?: string;
  nameEn?: string;
  nameFa?: string;
  nameAr?: string | null;
  defaultUomCode?: string | null;
};

function categoryName(listing: PublicListing, locale: Locale) {
  if (listing.category?.name) return listing.category.name;
  if (locale === 'fa') return listing.category?.nameFa || listing.category?.nameEn || null;
  if (locale === 'ar') return listing.category?.nameAr || listing.category?.nameEn || null;
  return listing.category?.nameEn || null;
}

function coverUrl(listing: PublicListing) {
  const m = (listing.media || []).find((x) => x.url && (!x.status || x.status === 'APPROVED'));
  return m?.url || null;
}

function catLabel(c: CategoryRow, locale: Locale) {
  if (locale === 'fa') return c.nameFa || c.name || c.nameEn || c.slug;
  if (locale === 'ar') return c.nameAr || c.nameEn || c.name || c.slug;
  return c.nameEn || c.name || c.nameFa || c.slug;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const copy = t(raw);
  return {
    title: copy.mp_meta_title,
    description: copy.mp_meta_description,
    alternates: {
      canonical: `/${raw}`,
      languages: { fa: '/fa', en: '/en', ar: '/ar' },
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const copy = t(locale);

  const [listings, categories] = await Promise.all([
    apiGet<PublicListing[]>(`/catalog/listings?locale=${encodeURIComponent(locale)}`),
    apiGet<CategoryRow[]>(`/categories?locale=${encodeURIComponent(locale)}`),
  ]);

  const allListings = listings || [];
  const featured = allListings.slice(0, 8);
  const heroSource = featured.find((l) => coverUrl(l)) || featured[0];
  const spotlight = heroSource
    ? {
        title: heroSource.title,
        slug: heroSource.slug,
        category: categoryName(heroSource, locale),
        imageUrl: coverUrl(heroSource),
      }
    : null;

  // Leaf categories only (have a parent) — like Material Bank material types.
  const leafCats = (categories || [])
    .filter((c) => c.parentId && c.defaultUomCode)
    .map((c) => ({ slug: c.slug, name: catLabel(c, locale), tone: 'neutral' }));

  return (
    <div className="mp-home mp-home--hub mp-home--materials">
      <MarketplaceHero copy={copy} locale={locale} spotlight={spotlight} />

      <MarketplaceCategoryGrid locale={locale} copy={copy} categories={leafCats} />

      <MarketplaceRoleStrip locale={locale} copy={copy} />

      <section className="mb-featured" aria-labelledby="mb-featured-title">
        <div className="mb-featured__inner">
          <div className="mb-featured__head">
            <h2 id="mb-featured-title" className="mp-section-title">
              {copy.mp_featured_title}
            </h2>
            <a className="mb-featured__link" href={`/${locale}/catalog`}>
              {copy.mp_cats_all}
            </a>
          </div>
          {featured.length === 0 ? (
            <div className="pk-empty">{copy.no_results}</div>
          ) : (
            <div className="mb-featured__grid">
              {featured.map((listing) => (
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
                    imageUrl: coverUrl(listing),
                    city: listing.facility?.address?.city || null,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
