import { notFound } from 'next/navigation';
import { PublicPageShell } from '@/components/PublicPageShell';
import { SearchClient } from '@/components/search/SearchClient';
import { isLocale, t } from '@/lib/i18n-public';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    from?: string;
    photo?: string;
    projectId?: string;
    requirementId?: string;
    category?: string;
    city?: string;
  }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const sp = await searchParams;
  const copy = t(raw);

  return (
    <PublicPageShell locale={raw} kicker={copy.brand} title={copy.search_title} lead={copy.mp_discovery_lead} wide>
      <SearchClient
        locale={raw}
        initialQuery={sp.q}
        initialPhotoMode={sp.photo === '1'}
        projectId={sp.projectId}
        requirementId={sp.requirementId}
      />
    </PublicPageShell>
  );
}
