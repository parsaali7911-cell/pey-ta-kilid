import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PublicPageShell } from '@/components/PublicPageShell';
import { isLocale, t } from '@/lib/i18n-public';
import ProfessionalsClient from './professionals-client';

export const dynamic = 'force-dynamic';

export default async function ProfessionalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    onboard?: string;
    find?: string;
    specialty?: string;
    city?: string;
    projectId?: string;
    requirementId?: string;
  }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const sp = await searchParams;
  const copy = t(raw);

  return (
    <PublicPageShell locale={raw} kicker={copy.nav_professionals} title={copy.pro_page_title} lead={copy.pro_page_lead} wide>
      <Suspense fallback={<p className="pk-notice">…</p>}>
        <ProfessionalsClient
          locale={raw}
          copy={copy}
          onboard={sp.onboard === '1'}
          findMode={sp.find === '1'}
          initialSpecialty={sp.specialty}
          initialCity={sp.city}
          projectId={sp.projectId}
          requirementId={sp.requirementId}
        />
      </Suspense>
    </PublicPageShell>
  );
}
