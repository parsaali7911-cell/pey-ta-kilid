import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocaleAlternatesBar } from '@/components/LocaleAlternatesBar';
import { RequestQuoteButton } from '@/components/commerce/RequestQuoteButton';
import { ListingChatPanel } from '@/components/commerce/ListingChatPanel';
import { PublicPageShell } from '@/components/PublicPageShell';
import { apiGet } from '@/lib/api';
import { formatMoney, formatQty } from '@/lib/format';
import { isLocale, t } from '@/lib/i18n-public';
import {
  isSeoLocale,
  listingJsonLdFromPublic,
  listingMetadataFromPublic,
  type PublicListingSeoSource,
} from '@/lib/seo';

export const dynamic = 'force-dynamic';

type PublicListingDetail = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  uomCode?: string | null;
  moq?: number | null;
  leadTimeDays?: number | null;
  category?: { name?: string | null; nameEn?: string | null; nameFa?: string | null; nameAr?: string | null } | null;
  organization?: { name?: string | null; slug?: string | null } | null;
  facility?: {
    type?: string | null;
    city?: string | null;
    province?: string | null;
    countryCode?: string | null;
  } | null;
  attributes?: Array<{
    valueString?: string | null;
    valueNumber?: number | null;
    valueBoolean?: boolean | null;
    attributeDefinition?: { code?: string | null; nameEn?: string | null } | null;
  }>;
  media?: Array<{ url?: string | null; status?: string | null; altText?: string | null }>;
  inventory?: { available?: number | null; uomCode?: string | null } | null;
  price?: {
    displayPrice?: number | null;
    currency?: string | null;
    priceType?: string | null;
  } | null;
};

type ListingSeoApiResponse = {
  metadata: {
    title: string;
    description?: string;
    canonical: string;
    alternates: Record<string, string>;
    openGraph: {
      title: string;
      description?: string;
      url: string;
      images?: Array<{ url: string }>;
      locale: string;
      type: 'website';
    };
    robots: { index: boolean; follow: boolean };
  };
  jsonLd: Record<string, unknown>;
};

async function fetchListingSeo(slug: string, locale: string) {
  return apiGet<ListingSeoApiResponse>(
    `/seo/listings/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
  );
}

async function fetchPublicListing(slug: string, locale: string) {
  return apiGet<PublicListingDetail>(
    `/catalog/listings/by-slug/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSeoLocale(locale)) return { robots: { index: false, follow: false } };
  const seo = await fetchListingSeo(slug, locale);
  if (seo) {
    return {
      title: seo.metadata.title,
      description: seo.metadata.description,
      alternates: { canonical: seo.metadata.canonical, languages: seo.metadata.alternates },
      openGraph: {
        title: seo.metadata.openGraph.title,
        description: seo.metadata.openGraph.description,
        url: seo.metadata.openGraph.url,
        images: seo.metadata.openGraph.images,
        locale: seo.metadata.openGraph.locale,
        type: seo.metadata.openGraph.type,
      },
      robots: seo.metadata.robots,
    };
  }
  const listing = await fetchPublicListing(slug, locale);
  if (!listing) return { title: 'پی تا کلید' };
  return listingMetadataFromPublic(listing as PublicListingSeoSource, locale);
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const copy = t(locale);
  const [seo, listing] = await Promise.all([
    fetchListingSeo(slug, locale),
    fetchPublicListing(slug, locale),
  ]);
  if (!listing) notFound();

  const jsonLd = seo?.jsonLd ?? listingJsonLdFromPublic(listing as PublicListingSeoSource, locale);
  const cover = (listing.media || []).find((m) => m.url && (!m.status || m.status === 'APPROVED'));
  const gallery = (listing.media || []).filter((m) => m.url && (!m.status || m.status === 'APPROVED'));
  const attrs = (listing.attributes || [])
    .map((a) => {
      const label = a.attributeDefinition?.code || a.attributeDefinition?.nameEn;
      const value =
        a.valueString ??
        (a.valueNumber != null ? String(a.valueNumber) : null) ??
        (a.valueBoolean != null ? String(a.valueBoolean) : null);
      if (!label || value == null) return null;
      return { label, value };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;

  const facilityLabel = listing.facility
    ? [listing.facility.city, listing.facility.province, listing.facility.countryCode]
        .filter(Boolean)
        .join(', ')
    : null;

  const category =
    listing.category?.name ||
    (locale === 'fa'
      ? listing.category?.nameFa || listing.category?.nameEn
      : locale === 'ar'
        ? listing.category?.nameAr || listing.category?.nameEn
        : listing.category?.nameEn) ||
    null;

  return (
    <PublicPageShell locale={locale} kicker={copy.listing_category} title={listing.title} lead={listing.description || undefined} wide>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ padding: '0 1.25rem' }}>
        <LocaleAlternatesBar
          locale={locale}
          pathWithoutLocale={`/catalog/${slug}`}
          copy={copy}
        />
      </div>
      <div className="pk-listing-detail">
        <div>
          <div className="pk-media-hero">
            {cover?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.url} alt={cover.altText || listing.title} />
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--sc-muted)' }}>
                {category || copy.catalog_title}
              </div>
            )}
          </div>
          {gallery.length > 1 ? (
            <div className="pk-media-thumbs" aria-label={copy.listing_gallery}>
              {gallery.map((m, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${m.url}-${idx}`} src={m.url || ''} alt={m.altText || listing.title} />
              ))}
            </div>
          ) : null}
          {attrs.length ? (
            <div style={{ padding: '1.25rem' }}>
              <h2 className="mp-section-title" style={{ fontSize: '1.25rem' }}>
                {copy.listing_specs}
              </h2>
              <div className="pk-kv">
                {attrs.map((a) => (
                  <div key={a.label} className="pk-kv-row">
                    <span className="muted" style={{ color: 'var(--sc-muted)' }}>
                      {a.label}
                    </span>
                    <strong>{a.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside style={{ padding: '1.25rem' }}>
          <div className="mp-stone-card__price" style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {formatMoney(listing.price?.displayPrice, listing.price?.currency, locale)}
          </div>
          {listing.price?.priceType ? (
            <div style={{ color: 'var(--sc-muted)', marginTop: 4 }}>{listing.price.priceType}</div>
          ) : null}
          <div className="pk-kv" style={{ marginTop: '1rem' }}>
            <div className="pk-kv-row">
              <span style={{ color: 'var(--sc-muted)' }}>{copy.listing_available}</span>
              <strong>
                {formatQty(
                  listing.inventory?.available,
                  listing.inventory?.uomCode || listing.uomCode,
                  locale,
                )}
              </strong>
            </div>
            <div className="pk-kv-row">
              <span style={{ color: 'var(--sc-muted)' }}>{copy.listing_moq}</span>
              <strong>{formatQty(listing.moq, listing.uomCode, locale)}</strong>
            </div>
            <div className="pk-kv-row">
              <span style={{ color: 'var(--sc-muted)' }}>{copy.listing_lead}</span>
              <strong>
                {listing.leadTimeDays != null ? `${listing.leadTimeDays} ${copy.days}` : '—'}
              </strong>
            </div>
            {listing.organization?.name ? (
              <div className="pk-kv-row">
                <span style={{ color: 'var(--sc-muted)' }}>{copy.listing_seller}</span>
                <strong>{listing.organization.name}</strong>
              </div>
            ) : null}
            {facilityLabel ? (
              <div className="pk-kv-row">
                <span style={{ color: 'var(--sc-muted)' }}>{copy.listing_facility}</span>
                <strong>{facilityLabel}</strong>
              </div>
            ) : null}
          </div>
          <div className="pk-listing-buybox pk-actions--stack">
            <RequestQuoteButton
              locale={locale}
              copy={copy}
              listingId={listing.id}
              listingTitle={listing.title}
              uomCode={listing.uomCode}
              defaultQty={listing.moq != null ? Number(listing.moq) : 1}
            />
            <ListingChatPanel
              locale={locale}
              copy={copy}
              listingSlug={listing.slug}
              sellerName={listing.organization?.name}
              listingTitle={listing.title}
              listingImageUrl={cover?.url || null}
            />
            <a className="mp-btn mp-btn--block" href={`/${locale}/designer?listing=${encodeURIComponent(listing.slug)}`}>
              {copy.listing_try_design}
            </a>
          </div>
        </aside>
      </div>
    </PublicPageShell>
  );
}
