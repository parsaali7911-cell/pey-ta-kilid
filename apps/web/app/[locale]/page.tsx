import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, t } from '@/lib/i18n-public';
import { MarketplaceHero } from '@/components/home/marketplace/MarketplaceHero';

export const dynamic = 'force-dynamic';

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

/** Home = search / demand understanding only. Catalog & roles live elsewhere. */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const copy = t(locale);

  return (
    <div className="mp-home mp-home--ai">
      <MarketplaceHero copy={copy} locale={locale} />
    </div>
  );
}
