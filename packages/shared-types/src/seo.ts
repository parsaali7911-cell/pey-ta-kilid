/** Public SEO locales for indexable Peytakilid URLs. */
export const SEO_LOCALES = ['fa', 'en', 'ar'] as const;

export type ListingSeoInput = {
  slug: string;
  title: string;
  description?: string | null;
  /** Prefer these over title/description when present (auto-generated or manual). */
  seoTitle?: string | null;
  seoDescription?: string | null;
  locale: string;
  siteUrl: string;
  categoryName?: string | null;
  sku?: string | null;
  displayPrice?: number | null;
  currency?: string | null;
  priceType?: string | null;
  images?: string[];
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
};

export type ListingSeoMetadata = {
  title: string;
  description: string | undefined;
  canonical: string;
  alternates: Record<string, string>;
  openGraph: {
    title: string;
    description: string | undefined;
    url: string;
    images?: Array<{ url: string }>;
    locale: string;
    type: 'website';
  };
  robots: { index: boolean; follow: boolean };
};

const SEO_PRIVATE_KEYS = [
  'supplierCost',
  'basePrice',
  'totalBasePrice',
  'marginPercentApplied',
  'fxRateApplied',
  'flatFeeApplied',
  'onHand',
  'reserved',
  'passwordHash',
  'line1',
  'latitude',
  'longitude',
] as const;

export function siteBaseUrl(env: {
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
} = process.env): string {
  return (
    env.SITE_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function listingPublicPath(locale: string, slug: string): string {
  return `/${locale}/catalog/${slug}`;
}

export function catalogPublicPath(locale: string): string {
  return `/${locale}/catalog`;
}

export function homePublicPath(locale: string): string {
  return `/${locale}`;
}

export function searchPublicPath(locale: string): string {
  return `/${locale}/search`;
}

export function listingHreflangAlternates(
  siteUrl: string,
  slug: string,
  locales: readonly string[] = SEO_LOCALES,
): Record<string, string> {
  const base = siteUrl.replace(/\/$/, '');
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = `${base}${listingPublicPath(locale, slug)}`;
  }
  languages['x-default'] = languages['en'] || languages[locales[0]] || languages['fa'];
  return languages;
}

export function buildListingSeoMetadata(input: ListingSeoInput): ListingSeoMetadata {
  const base = input.siteUrl.replace(/\/$/, '');
  const path = listingPublicPath(input.locale, input.slug);
  const canonical = `${base}${path}`;
  const title = (input.seoTitle || input.title).trim();
  const description =
    (input.seoDescription || input.description)?.trim() || undefined;
  const images = (input.images || []).filter(Boolean).map((url) => ({ url }));

  const meta: ListingSeoMetadata = {
    title,
    description,
    canonical,
    alternates: listingHreflangAlternates(base, input.slug),
    openGraph: {
      title,
      description,
      url: canonical,
      images: images.length ? images : undefined,
      locale: input.locale,
      type: 'website',
    },
    robots: { index: true, follow: true },
  };
  assertNoPrivateSeoLeak(meta);
  return meta;
}

/** Generic Product + Offer + BreadcrumbList JSON-LD (no stone/factory fields). */
export function buildListingJsonLd(input: ListingSeoInput): Record<string, unknown> {
  const base = input.siteUrl.replace(/\/$/, '');
  const path = listingPublicPath(input.locale, input.slug);
  const url = `${base}${path}`;
  const images = (input.images || []).filter(Boolean);

  const product: Record<string, unknown> = {
    '@type': 'Product',
    name: input.title,
    description: input.description?.trim() || undefined,
    sku: input.sku || undefined,
    category: input.categoryName || undefined,
    url,
    image: images.length ? images : undefined,
  };

  if (input.displayPrice != null && input.currency) {
    product.offers = {
      '@type': 'Offer',
      priceCurrency: input.currency,
      price: String(input.displayPrice),
      availability: `https://schema.org/${input.availability || 'InStock'}`,
      url,
    };
  }

  if (input.priceType) {
    product.additionalProperty = [
      {
        '@type': 'PropertyValue',
        name: 'priceType',
        value: input.priceType,
      },
    ];
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      product,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${base}${homePublicPath(input.locale)}`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Catalog',
            item: `${base}${catalogPublicPath(input.locale)}`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: input.title,
            item: url,
          },
        ],
      },
    ],
  };
  assertNoPrivateSeoLeak(jsonLd);
  return jsonLd;
}

export function assertNoPrivateSeoLeak(payload: unknown): void {
  const json = JSON.stringify(payload);
  for (const key of SEO_PRIVATE_KEYS) {
    if (json.includes(`"${key}"`)) {
      throw new Error(`SEO payload leak detected: ${key}`);
    }
  }
  // Reject foreign stone-marketplace SEO tokens if they leak into payloads
  for (const banned of ['FactoryProduct', 'MineBlock', 'stoneType', 'stoncity', '/stones/'] as const) {
    if (json.includes(banned)) {
      throw new Error(`SEO payload contains banned foreign marketplace token: ${banned}`);
    }
  }
}

export type SitemapEntry = {
  url: string;
  lastModified?: string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
};

export function buildStaticSitemapEntries(
  siteUrl: string,
  locales: readonly string[] = SEO_LOCALES,
): SitemapEntry[] {
  const base = siteUrl.replace(/\/$/, '');
  const entries: SitemapEntry[] = [];
  for (const locale of locales) {
    entries.push({
      url: `${base}${homePublicPath(locale)}`,
      changeFrequency: 'weekly',
      priority: 1,
    });
    entries.push({
      url: `${base}${catalogPublicPath(locale)}`,
      changeFrequency: 'daily',
      priority: 0.9,
    });
    entries.push({
      url: `${base}${searchPublicPath(locale)}`,
      changeFrequency: 'daily',
      priority: 0.8,
    });
    entries.push({
      url: `${base}${professionalsPublicPath(locale)}`,
      changeFrequency: 'daily',
      priority: 0.75,
    });
    entries.push({
      url: `${base}/${locale}/designer`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  return entries;
}

export function buildListingSitemapEntries(
  siteUrl: string,
  listings: Array<{ slug: string; updatedAt?: Date | string | null }>,
  locales: readonly string[] = SEO_LOCALES,
): SitemapEntry[] {
  const base = siteUrl.replace(/\/$/, '');
  const entries: SitemapEntry[] = [];
  for (const listing of listings) {
    if (!listing.slug) continue;
    const lastModified =
      listing.updatedAt instanceof Date
        ? listing.updatedAt.toISOString()
        : listing.updatedAt || undefined;
    for (const locale of locales) {
      entries.push({
        url: `${base}${listingPublicPath(locale, listing.slug)}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }
  return entries;
}

export function robotsTxtBody(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /*/admin',
    'Disallow: /account',
    'Disallow: /*/account',
    'Disallow: /seller',
    'Disallow: /*/seller',
    'Disallow: /api',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}

export type AutoListingSeoInput = {
  title: string;
  description?: string | null;
  categoryName?: string | null;
  city?: string | null;
  locale?: string;
  brand?: string;
};

export type AutoProfessionalSeoInput = {
  name: string;
  specialtyLabel?: string | null;
  city?: string | null;
  province?: string | null;
  locale?: string;
  brand?: string;
};

/** Deterministic SEO copy — no LLM required. Safe for create/publish hooks. */
export function autoGenerateListingSeo(input: AutoListingSeoInput): {
  seoTitle: string;
  seoDescription: string;
} {
  const brand = input.brand || 'Peytakilid';
  const locale = input.locale || 'fa';
  const cat = (input.categoryName || '').trim();
  const city = (input.city || '').trim();
  const title = input.title.trim();
  const baseDesc = (input.description || '').trim().replace(/\s+/g, ' ');

  if (locale === 'fa') {
    const bits = [title];
    if (cat) bits.push(cat);
    if (city) bits.push(city);
    bits.push(brand);
    const seoTitle = bits.join(' | ').slice(0, 65);
    const seoDescription = (
      baseDesc ||
      `خرید ${title}${cat ? ` در دسته ${cat}` : ''}${city ? ` — تأمین برای ${city}` : ''} از مارکت‌پلیس ${brand}. قیمت عمومی و موجودی واقعی.`
    ).slice(0, 160);
    return { seoTitle, seoDescription };
  }

  if (locale === 'ar') {
    const bits = [title];
    if (cat) bits.push(cat);
    if (city) bits.push(city);
    bits.push(brand);
    return {
      seoTitle: bits.join(' | ').slice(0, 65),
      seoDescription: (
        baseDesc ||
        `اشترِ ${title}${cat ? ` من فئة ${cat}` : ''}${city ? ` للتوريد في ${city}` : ''} عبر سوق ${brand}.`
      ).slice(0, 160),
    };
  }

  const bits = [title];
  if (cat) bits.push(cat);
  if (city) bits.push(city);
  bits.push(brand);
  return {
    seoTitle: bits.join(' | ').slice(0, 65),
    seoDescription: (
      baseDesc ||
      `Buy ${title}${cat ? ` in ${cat}` : ''}${city ? ` for projects in ${city}` : ''} on ${brand}. Public price and real availability.`
    ).slice(0, 160),
  };
}

export function autoGenerateProfessionalSeo(input: AutoProfessionalSeoInput): {
  seoTitle: string;
  seoDescription: string;
} {
  const brand = input.brand || 'Peytakilid';
  const locale = input.locale || 'fa';
  const name = input.name.trim();
  const specialty = (input.specialtyLabel || '').trim();
  const place = [input.city, input.province].filter(Boolean).join('، ');

  if (locale === 'fa') {
    return {
      seoTitle: [name, specialty, place, `متخصص ${brand}`].filter(Boolean).join(' | ').slice(0, 65),
      seoDescription: `${name}${specialty ? ` — ${specialty}` : ''}${place ? ` در ${place}` : ''}؛ معرفی‌شده در دایرکتوری متخصصان ${brand}.`.slice(
        0,
        160,
      ),
    };
  }

  return {
    seoTitle: [name, specialty, place, `${brand} professional`].filter(Boolean).join(' | ').slice(0, 65),
    seoDescription: `${name}${specialty ? ` — ${specialty}` : ''}${place ? ` in ${place}` : ''}. Listed on the ${brand} professionals directory.`.slice(
      0,
      160,
    ),
  };
}

export function professionalsPublicPath(locale: string): string {
  return `/${locale}/professionals`;
}
