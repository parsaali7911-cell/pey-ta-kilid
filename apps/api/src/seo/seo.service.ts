import { Injectable } from '@nestjs/common';
import { ListingStatus, LocalizedEntityType, MediaStatus } from '@prisma/client';
import {
  SEO_LOCALES,
  buildListingJsonLd,
  buildListingSeoMetadata,
  buildListingSitemapEntries,
  buildStaticSitemapEntries,
  robotsTxtBody,
  siteBaseUrl,
  type ListingSeoInput,
  type SitemapEntry,
} from '@peytakilid/shared-types';
import { LocalizationService } from '../i18n/localization.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localization: LocalizationService,
  ) {}

  siteUrl() {
    return siteBaseUrl({
      SITE_URL: process.env.SITE_URL,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    });
  }

  robotsTxt(): string {
    return robotsTxtBody(this.siteUrl());
  }

  async sitemapJson(): Promise<{ baseUrl: string; entries: SitemapEntry[] }> {
    const baseUrl = this.siteUrl();
    const listings = await this.prisma.listing.findMany({
      where: { status: ListingStatus.PUBLISHED },
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });

    const entries = [
      ...buildStaticSitemapEntries(baseUrl, SEO_LOCALES),
      ...buildListingSitemapEntries(
        baseUrl,
        listings.map((l) => ({
          slug: l.slug,
          updatedAt: l.updatedAt || l.publishedAt,
        })),
        SEO_LOCALES,
      ),
    ];

    return { baseUrl, entries };
  }

  async sitemapXml(): Promise<string> {
    const { entries } = await this.sitemapJson();
    const urls = entries
      .map((e) => {
        const last = e.lastModified ? `\n    <lastmod>${escapeXml(e.lastModified)}</lastmod>` : '';
        return `  <url>\n    <loc>${escapeXml(e.url)}</loc>${last}\n  </url>`;
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  }

  /** Public listing SEO contract for a published Listing slug. */
  async listingSeo(slug: string, locale: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { slug, status: ListingStatus.PUBLISHED },
      include: {
        category: { select: { nameEn: true, nameFa: true, nameAr: true, slug: true } },
        variant: { select: { sku: true } },
        price: { select: { displayPrice: true, currency: true, priceType: true } },
        media: {
          where: { status: MediaStatus.APPROVED },
          orderBy: { sortOrder: 'asc' },
          select: { url: true },
        },
        inventory: { select: { onHand: true, reserved: true } },
      },
    });
    if (!listing) return null;

    const images = listing.media
      .map((m) => m.url)
      .filter((u): u is string => Boolean(u));

    const available =
      listing.inventory != null
        ? Math.max(0, Number(listing.inventory.onHand) - Number(listing.inventory.reserved))
        : null;

    const categoryName = resolveCategoryName(listing.category, locale);

    const seoTitleMap = await this.localization.getFieldMap(
      LocalizedEntityType.LISTING,
      listing.id,
      'seoTitle',
    );
    const seoDescMap = await this.localization.getFieldMap(
      LocalizedEntityType.LISTING,
      listing.id,
      'seoDescription',
    );

    const input: ListingSeoInput = {
      slug: listing.slug,
      title: listing.title,
      description: listing.description,
      seoTitle: seoTitleMap[locale] || seoTitleMap.fa || seoTitleMap.en || null,
      seoDescription: seoDescMap[locale] || seoDescMap.fa || seoDescMap.en || null,
      locale,
      siteUrl: this.siteUrl(),
      categoryName,
      sku: listing.variant?.sku ?? null,
      displayPrice: listing.price ? Number(listing.price.displayPrice) : null,
      currency: listing.price?.currency ?? null,
      priceType: listing.price?.priceType ?? null,
      images,
      availability: available == null ? 'InStock' : available > 0 ? 'InStock' : 'OutOfStock',
    };

    return {
      slug: listing.slug,
      locale,
      metadata: buildListingSeoMetadata(input),
      jsonLd: buildListingJsonLd(input),
    };
  }
}

function resolveCategoryName(
  category: { nameEn: string; nameFa: string | null; nameAr: string | null; slug: string } | null,
  locale: string,
): string | null {
  if (!category) return null;
  if (locale === 'fa') return category.nameFa || category.nameEn || category.slug;
  if (locale === 'ar') return category.nameAr || category.nameEn || category.slug;
  return category.nameEn || category.slug;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
