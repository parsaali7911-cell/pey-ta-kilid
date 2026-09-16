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

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const copy = t(locale);
  const listings =
    (await apiGet<PublicListing[]>(`/catalog/listings?locale=${encodeURIComponent(locale)}`)) ||
    [];

  return (
    <PublicPageShell locale={locale} kicker={copy.brand} title={copy.catalog_title} lead={copy.catalog_lead} wide>
      {listings.length === 0 ? (
        <div className="pk-empty">{copy.no_results}</div>
      ) : (
        <div className="pk-catalog-grid">
          {listings.map((listing) => {
            const media = (listing.media || []).find(
              (m) => m.url && (!m.status || m.status === 'APPROVED'),
            );
            return (
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
