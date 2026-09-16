import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, t } from '@/lib/i18n-public';
import SellerClient from './seller-client';

export const dynamic = 'force-dynamic';

export default async function SellerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; wizard?: string; category?: string; city?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const sp = await searchParams;
  const copy = t(raw);

  return (
    <main className="panel-page" dir={raw === 'en' ? 'ltr' : 'rtl'} lang={raw}>
      <Suspense fallback={<p className="pk-notice">…</p>}>
        <SellerClient
          locale={raw}
          copy={copy}
          initialTab={sp.tab === 'listing' || sp.wizard === '1' ? 'listing' : sp.tab}
          initialCategorySlug={sp.category}
          initialCity={sp.city}
          openWizard={sp.wizard === '1' || Boolean(sp.category)}
        />
      </Suspense>
    </main>
  );
}
