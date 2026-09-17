import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { isLocale, t, type Locale } from '@/lib/i18n-public';
import { MarketplaceHero } from '@/components/home/marketplace/MarketplaceHero';
import { MarketplaceEntryPaths } from '@/components/home/marketplace/MarketplaceEntryPaths';
import { MarketplaceListingCard } from '@/components/home/marketplace/MarketplaceListingCard';

export const dynamic = 'force-dynamic';

type PublicListing = {
  slug: string;
  title: string;
  uomCode?: string | null;
  price?: { displayPrice?: number | null; currency?: string | null } | null;
  category?: {
    name?: string | null;
    nameEn?: string | null;
    nameFa?: string | null;
    nameAr?: string | null;
  } | null;
  organization?: { name?: string | null } | null;
  media?: Array<{ url?: string | null; status?: string | null }>;
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
  const listings =
    (await apiGet<PublicListing[]>(`/catalog/listings?locale=${encodeURIComponent(locale)}`)) ||
    [];
  const featured = listings.slice(0, 6);
  const heroSource = featured[0];
  const spotlight = heroSource
    ? {
        title: heroSource.title,
        slug: heroSource.slug,
        category: categoryName(heroSource, locale),
        imageUrl: coverUrl(heroSource),
      }
    : null;

  return (
    <div className="mp-home mp-home--hub">
      <MarketplaceHero copy={copy} locale={locale} spotlight={spotlight} />

      <MarketplaceEntryPaths locale={locale} copy={copy} />

      <section className="mp-featured" aria-labelledby="mp-featured-title">
        <div className="mp-featured__inner" style={{ padding: '0 var(--mp-x) 2.5rem' }}>
          <h2 id="mp-featured-title" className="mp-section-title">
            {copy.mp_featured_title}
          </h2>
          {copy.mp_featured_lead ? <p className="mp-section-lead">{copy.mp_featured_lead}</p> : null}
          {featured.length === 0 ? (
            <div className="pk-empty">{copy.no_results}</div>
          ) : (
            <div
              className="mp-featured__grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))',
                gap: '1.1rem',
                marginTop: '1.25rem',
              }}
            >
              {featured.map((listing) => (
                <MarketplaceListingCard
                  key={listing.slug}
                  locale={locale}
                  copy={copy}
                  listing={{
                    slug: listing.slug,
                    title: listing.title,
                    categoryName: categoryName(listing, locale),
                    sellerName: listing.organization?.name,
                    displayPrice: listing.price?.displayPrice,
                    currency: listing.price?.currency,
                    uomCode: listing.uomCode,
                    imageUrl: coverUrl(listing),
                  }}
                />
              ))}
            </div>
          )}
          <div className="mp-btn-row" style={{ marginTop: '1.25rem' }}>
            <a className="mp-btn mp-btn--primary" href={`/${locale}/catalog`}>
              {copy.mp_hero_cta} →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
