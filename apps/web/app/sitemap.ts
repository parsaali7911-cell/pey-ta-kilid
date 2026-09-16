import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/seo';

export const dynamic = 'force-dynamic';

type SitemapJson = {
  baseUrl: string;
  entries: Array<{
    url: string;
    lastModified?: string;
    changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority?: number;
  }>;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const api = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
  try {
    const res = await fetch(`${api}/api/seo/sitemap`, { next: { revalidate: 60 } });
    if (!res.ok) return fallbackStatic();
    const data = (await res.json()) as SitemapJson;
    return (data.entries || []).map((e) => ({
      url: e.url,
      lastModified: e.lastModified ? new Date(e.lastModified) : undefined,
      changeFrequency: e.changeFrequency,
      priority: e.priority,
    }));
  } catch {
    return fallbackStatic();
  }
}

function fallbackStatic(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return ['fa', 'en', 'ar'].flatMap((locale) => [
    { url: `${base}/${locale}`, changeFrequency: 'weekly' as const, priority: 1 },
    { url: `${base}/${locale}/catalog`, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${base}/${locale}/search`, changeFrequency: 'daily' as const, priority: 0.8 },
  ]);
}
