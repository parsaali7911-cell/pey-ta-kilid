import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, t } from '@/lib/i18n-public';
import ProjectWorkspaceClient from './project-workspace-client';

export const dynamic = 'force-dynamic';

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const copy = t(raw);
  return (
    <main className="panel-page" dir={raw === 'en' ? 'ltr' : 'rtl'} lang={raw}>
      <Suspense fallback={<p className="pk-notice">…</p>}>
        <ProjectWorkspaceClient locale={raw} projectId={id} copy={copy} />
      </Suspense>
    </main>
  );
}
