import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, t } from '@/lib/i18n-public';
import BuyerClient from './buyer-client';

export const dynamic = 'force-dynamic';

export default async function BuyerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; highlight?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const sp = await searchParams;
  const copy = t(raw);
  return (
    <main className="panel-page" dir={raw === 'en' ? 'ltr' : 'rtl'} lang={raw}>
      <Suspense fallback={<p className="pk-notice">…</p>}>
        <BuyerClient locale={raw} copy={copy} initialTab={sp.tab} highlightId={sp.highlight} />
      </Suspense>
    </main>
  );
}
