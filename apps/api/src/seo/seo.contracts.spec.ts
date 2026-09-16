import { ListingStatus, MediaStatus } from '@prisma/client';
import {
  SEO_LOCALES,
  assertNoPrivateSeoLeak,
  buildListingJsonLd,
  buildListingSeoMetadata,
  buildListingSitemapEntries,
  buildStaticSitemapEntries,
  listingHreflangAlternates,
  listingPublicPath,
  robotsTxtBody,
} from '@peytakilid/shared-types';
import { SeoService } from './seo.service';

describe('SEO foundation', () => {
  const siteUrl = 'https://peytakilid.example';

  describe('shared builders', () => {
    it('builds locale-aware static sitemap entries for fa/en/ar', () => {
      const entries = buildStaticSitemapEntries(siteUrl, SEO_LOCALES);
      const urls = entries.map((e) => e.url);
      for (const locale of SEO_LOCALES) {
        expect(urls).toContain(`${siteUrl}/${locale}`);
        expect(urls).toContain(`${siteUrl}/${locale}/catalog`);
        expect(urls).toContain(`${siteUrl}/${locale}/search`);
      }
      expect(urls.join(' ')).not.toMatch(/FactoryProduct|stoncity|\/stones\//i);
      expect(urls.join(' ')).not.toMatch(/\/admin|\/api|\/account|\/seller/);
    });

    it('builds listing sitemap URLs from Listing.slug only', () => {
      const entries = buildListingSitemapEntries(siteUrl, [
        { slug: 'ceramic-tile-a', updatedAt: '2026-01-01T00:00:00.000Z' },
      ]);
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.url)).toEqual([
        `${siteUrl}/fa/catalog/ceramic-tile-a`,
        `${siteUrl}/en/catalog/ceramic-tile-a`,
        `${siteUrl}/ar/catalog/ceramic-tile-a`,
      ]);
      expect(entries[0].lastModified).toBe('2026-01-01T00:00:00.000Z');
    });

    it('robots disallow private/admin/API surfaces and point to sitemap', () => {
      const body = robotsTxtBody(siteUrl);
      expect(body).toContain('Allow: /');
      expect(body).toContain('Disallow: /admin');
      expect(body).toContain('Disallow: /account');
      expect(body).toContain('Disallow: /seller');
      expect(body).toContain('Disallow: /api');
      expect(body).toContain(`Sitemap: ${siteUrl}/sitemap.xml`);
    });

    it('builds canonical, hreflang, and OpenGraph metadata', () => {
      const meta = buildListingSeoMetadata({
        slug: 'steel-beam',
        title: 'Steel Beam',
        description: 'Structural steel beam',
        locale: 'en',
        siteUrl,
        images: ['https://cdn.example/beam.jpg'],
        displayPrice: 120,
        currency: 'USD',
        priceType: 'EXW',
      });
      expect(meta.canonical).toBe(`${siteUrl}/en/catalog/steel-beam`);
      expect(meta.alternates).toEqual(
        listingHreflangAlternates(siteUrl, 'steel-beam'),
      );
      expect(meta.alternates.fa).toBe(`${siteUrl}/fa/catalog/steel-beam`);
      expect(meta.alternates.en).toBe(`${siteUrl}/en/catalog/steel-beam`);
      expect(meta.alternates.ar).toBe(`${siteUrl}/ar/catalog/steel-beam`);
      expect(meta.alternates['x-default']).toBe(`${siteUrl}/en/catalog/steel-beam`);
      expect(meta.openGraph.url).toBe(meta.canonical);
      expect(meta.openGraph.title).toBe('Steel Beam');
      expect(meta.openGraph.images?.[0].url).toBe('https://cdn.example/beam.jpg');
      expect(meta.robots).toEqual({ index: true, follow: true });
    });

    it('JSON-LD Product/Offer contains no private fields or STONCITY tokens', () => {
      const jsonLd = buildListingJsonLd({
        slug: 'pipe-fitting',
        title: 'Pipe Fitting',
        description: 'Public listing',
        locale: 'fa',
        siteUrl,
        sku: 'SKU-1',
        categoryName: 'Plumbing',
        displayPrice: 45.5,
        currency: 'IRR',
        priceType: 'FOB',
        images: ['https://cdn.example/fit.jpg'],
        availability: 'InStock',
      });
      assertNoPrivateSeoLeak(jsonLd);
      const serialized = JSON.stringify(jsonLd);
      expect(serialized).not.toMatch(
        /supplierCost|basePrice|onHand|reserved|passwordHash|FactoryProduct|MineBlock|stoncity|\/stones\//,
      );
      expect(jsonLd['@context']).toBe('https://schema.org');
      const graph = jsonLd['@graph'] as Array<Record<string, unknown>>;
      const product = graph.find((n) => n['@type'] === 'Product')!;
      expect(product.name).toBe('Pipe Fitting');
      expect(product.url).toBe(`${siteUrl}${listingPublicPath('fa', 'pipe-fitting')}`);
      const offer = product.offers as Record<string, unknown>;
      expect(offer['@type']).toBe('Offer');
      expect(offer.price).toBe('45.5');
      expect(offer.priceCurrency).toBe('IRR');
      expect(offer).not.toHaveProperty('supplierCost');
      expect(offer).not.toHaveProperty('onHand');
    });

    it('assertNoPrivateSeoLeak rejects private and STONCITY keys', () => {
      expect(() => assertNoPrivateSeoLeak({ supplierCost: 1 })).toThrow(/supplierCost/);
      expect(() => assertNoPrivateSeoLeak({ FactoryProduct: true })).toThrow(/FactoryProduct/);
      expect(() => assertNoPrivateSeoLeak({ path: '/stones/x' })).toThrow(/\/stones\//);
    });
  });

  describe('SeoService', () => {
    function mockPrisma(state: {
      listings: Array<{
        slug: string;
        status: string;
        updatedAt?: Date;
        publishedAt?: Date | null;
        title?: string;
        description?: string | null;
        category?: { name: string } | null;
        variant?: { sku: string | null } | null;
        price?: {
          displayPrice: number;
          currency: string;
          priceType: string;
          supplierCost?: number;
        } | null;
        media?: Array<{ url: string | null; status?: string }>;
        inventory?: { onHand: number; reserved: number } | null;
      }>;
    }) {
      return {
        listing: {
          findMany: jest.fn(async ({ where }: { where: { status: string } }) =>
            state.listings
              .filter((l) => l.status === where.status)
              .map((l) => ({
                slug: l.slug,
                updatedAt: l.updatedAt ?? new Date('2026-02-01T00:00:00.000Z'),
                publishedAt: l.publishedAt ?? null,
              })),
          ),
          findFirst: jest.fn(
            async ({
              where,
            }: {
              where: { slug: string; status: string };
            }) => {
              const row = state.listings.find(
                (l) => l.slug === where.slug && l.status === where.status,
              );
              if (!row) return null;
              return {
                slug: row.slug,
                title: row.title ?? row.slug,
                description: row.description ?? null,
                category: row.category
                  ? {
                      nameEn: row.category.name,
                      nameFa: row.category.name,
                      nameAr: row.category.name,
                      slug: 'general',
                    }
                  : {
                      nameEn: 'General',
                      nameFa: 'General',
                      nameAr: 'General',
                      slug: 'general',
                    },
                variant: row.variant ?? { sku: 'SKU' },
                price: row.price
                  ? {
                      displayPrice: row.price.displayPrice,
                      currency: row.price.currency,
                      priceType: row.price.priceType,
                    }
                  : null,
                media: (row.media || []).filter(
                  (m) => !m.status || m.status === MediaStatus.APPROVED,
                ),
                inventory: row.inventory ?? null,
              };
            },
          ),
        },
      };
    }

    it('sitemap includes only PUBLISHED listings across locales', async () => {
      process.env.SITE_URL = siteUrl;
      const prisma = mockPrisma({
        listings: [
          {
            slug: 'published-tile',
            status: ListingStatus.PUBLISHED,
            updatedAt: new Date('2026-03-01T00:00:00.000Z'),
          },
          { slug: 'draft-tile', status: ListingStatus.DRAFT },
          { slug: 'pending-tile', status: ListingStatus.PENDING_REVIEW },
          { slug: 'archived-tile', status: ListingStatus.ARCHIVED },
        ],
      });
      const seo = new SeoService(prisma as never);
      const { entries } = await seo.sitemapJson();
      const urls = entries.map((e) => e.url);

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ListingStatus.PUBLISHED },
          select: { slug: true, updatedAt: true, publishedAt: true },
        }),
      );

      for (const locale of SEO_LOCALES) {
        expect(urls).toContain(`${siteUrl}/${locale}/catalog/published-tile`);
      }
      expect(urls.join('\n')).not.toContain('draft-tile');
      expect(urls.join('\n')).not.toContain('pending-tile');
      expect(urls.join('\n')).not.toContain('archived-tile');
      expect(urls.join('\n')).not.toMatch(/FactoryProduct|stoncity|mine|\/stones\//i);
    });

    it('listingSeo returns metadata + JSON-LD for published slug only', async () => {
      process.env.SITE_URL = siteUrl;
      const prisma = mockPrisma({
        listings: [
          {
            slug: 'public-door',
            status: ListingStatus.PUBLISHED,
            title: 'Public Door',
            description: 'Exterior door',
            category: { name: 'Doors' },
            variant: { sku: 'DOOR-1' },
            price: {
              displayPrice: 200,
              currency: 'USD',
              priceType: 'EXW',
              supplierCost: 150,
            },
            media: [
              { url: 'https://cdn.example/door.jpg', status: MediaStatus.APPROVED },
              { url: 'https://cdn.example/private.jpg', status: MediaStatus.PRIVATE },
            ],
            inventory: { onHand: 10, reserved: 2 },
          },
          {
            slug: 'draft-door',
            status: ListingStatus.DRAFT,
            title: 'Draft Door',
          },
        ],
      });
      const seo = new SeoService(prisma as never);

      expect(await seo.listingSeo('draft-door', 'en')).toBeNull();

      const result = await seo.listingSeo('public-door', 'en');
      expect(result).not.toBeNull();
      expect(result!.metadata.canonical).toBe(`${siteUrl}/en/catalog/public-door`);
      expect(result!.metadata.alternates.fa).toBe(`${siteUrl}/fa/catalog/public-door`);
      expect(result!.metadata.openGraph.title).toBe('Public Door');
      assertNoPrivateSeoLeak(result!.metadata);
      assertNoPrivateSeoLeak(result!.jsonLd);

      const blob = JSON.stringify(result);
      expect(blob).not.toMatch(/supplierCost|onHand|reserved|passwordHash/);
      expect(blob).not.toMatch(/FactoryProduct|MineBlock|stoncity|\/stones\//);
      expect(blob).toContain('https://cdn.example/door.jpg');
      expect(blob).not.toContain('private.jpg');
    });

    it('robotsTxt delegates to shared robots body', () => {
      process.env.SITE_URL = siteUrl;
      const seo = new SeoService(mockPrisma({ listings: [] }) as never);
      expect(seo.robotsTxt()).toBe(robotsTxtBody(siteUrl));
    });
  });
});
