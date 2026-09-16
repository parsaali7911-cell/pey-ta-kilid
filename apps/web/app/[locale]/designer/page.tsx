import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PublicPageShell } from '@/components/PublicPageShell';
import { isLocale, t } from '@/lib/i18n-public';
import DesignerClient from './designer-client';

export const dynamic = 'force-dynamic';

export default async function DesignerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ listing?: string; product?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const copy = t(raw);
  const sp = await searchParams;
  const initialListingRef =
    (typeof sp.listing === 'string' && sp.listing) ||
    (typeof sp.product === 'string' && sp.product) ||
    '';

  return (
    <PublicPageShell
      locale={raw}
      kicker={copy.nav_design}
      title={copy.designer_title}
      lead={copy.designer_lead}
      wide
    >
      <Suspense fallback={<p className="pk-notice">…</p>}>
        <DesignerClient locale={raw} copy={copy} initialListingRef={initialListingRef} />
      </Suspense>
    </PublicPageShell>
  );
}
