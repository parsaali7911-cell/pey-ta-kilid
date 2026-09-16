import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PublicPageShell } from '@/components/PublicPageShell';
import { apiGet } from '@/lib/api';
import { isLocale, t } from '@/lib/i18n-public';
import ProfessionalPublicClient from '../professional-public-client';

export const dynamic = 'force-dynamic';

type ProSeo = {
  name: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  specialtyLabel?: string | null;
  profile?: { displayName?: string | null } | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const pro = await apiGet<ProSeo>(`/professionals/by-slug/${encodeURIComponent(slug)}?locale=${locale}`);
  if (!pro) return { title: 'پی تا کلید' };
  return {
    title: pro.seoTitle || `${pro.profile?.displayName || pro.name} | پی تا کلید`,
    description: pro.seoDescription || undefined,
  };
}

export default async function ProfessionalPublicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const copy = t(locale);
  return (
    <PublicPageShell locale={locale} kicker={copy.nav_professionals} title={copy.pro_page_title} wide>
      <ProfessionalPublicClient locale={locale} slug={slug} copy={copy} />
    </PublicPageShell>
  );
}
