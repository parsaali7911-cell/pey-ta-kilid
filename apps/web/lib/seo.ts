import type { Metadata } from 'next';
import {
  SEO_LOCALES,
  buildListingJsonLd,
  buildListingSeoMetadata,
  siteBaseUrl,
  type ListingSeoInput,
} from '@peytakilid/shared-types';
import { getLocaleMeta, listBuiltinLocales } from './i18n';

export { SEO_LOCALES, siteBaseUrl };

export function isSeoLocale(code: string): boolean {
  return (SEO_LOCALES as readonly string[]).includes(code);
}

export function getSiteUrl(): string {
  return siteBaseUrl({
    SITE_URL: process.env.SITE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export type PublicListingSeoSource = {
  slug: string;
  title: string;
  description?: string | null;
  category?: { name?: string | null } | null;
  variant?: { sku?: string | null } | null;
  price?: {
    displayPrice?: number | null;
    currency?: string | null;
    priceType?: string | null;
  } | null;
  media?: Array<{ url?: string | null }>;
  inventory?: { available?: number | null } | null;
};

export function toListingSeoInput(
  listing: PublicListingSeoSource,
  locale: string,
  siteUrl = getSiteUrl(),
): ListingSeoInput {
  const images = (listing.media || [])
    .map((m) => m.url)
    .filter((u): u is string => Boolean(u));
  const available = listing.inventory?.available;
  return {
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    locale,
    siteUrl,
    categoryName: listing.category?.name ?? null,
    sku: listing.variant?.sku ?? null,
    displayPrice: listing.price?.displayPrice ?? null,
    currency: listing.price?.currency ?? null,
    priceType: listing.price?.priceType ?? null,
    images,
    availability:
      available == null ? 'InStock' : available > 0 ? 'InStock' : 'OutOfStock',
  };
}

/** Next.js Metadata for a public Listing page. */
export function listingMetadataFromPublic(
  listing: PublicListingSeoSource,
  locale: string,
): Metadata {
  const meta = buildListingSeoMetadata(toListingSeoInput(listing, locale));
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: meta.canonical,
      languages: meta.alternates,
    },
    openGraph: {
      title: meta.openGraph.title,
      description: meta.openGraph.description,
      url: meta.openGraph.url,
      images: meta.openGraph.images,
      locale: meta.openGraph.locale,
      type: meta.openGraph.type,
    },
    robots: meta.robots,
  };
}

export function listingJsonLdFromPublic(
  listing: PublicListingSeoSource,
  locale: string,
): Record<string, unknown> {
  return buildListingJsonLd(toListingSeoInput(listing, locale));
}

export function defaultLocaleCode(): string {
  return getLocaleMeta().code;
}

export function publicLocales(): string[] {
  return listBuiltinLocales().map((l) => l.code);
}
