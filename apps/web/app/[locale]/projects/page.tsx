import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, t } from '@/lib/i18n-public';
import ProjectsClient from './projects-client';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const copy = t(raw);
  return (
    <main className="panel-page" dir={raw === 'en' ? 'ltr' : 'rtl'} lang={raw}>
      <Suspense fallback={<p className="pk-notice">…</p>}>
        <ProjectsClient locale={raw} copy={copy} />
      </Suspense>
    </main>
  );
}
