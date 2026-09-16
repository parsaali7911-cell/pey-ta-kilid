import { notFound } from 'next/navigation';
import { PublicPageShell } from '@/components/PublicPageShell';
import { isLocale, t } from '@/lib/i18n-public';
import { LoginClient } from './login-client';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const sp = await searchParams;
  const copy = t(raw);
  return (
    <PublicPageShell locale={raw} kicker={copy.auth_kicker} title={copy.auth_login_title} lead={copy.auth_login_lead}>
      <div className="panel-workspace" style={{ padding: '1.25rem' }}>
        <LoginClient locale={raw} copy={copy} nextPath={sp.next} />
      </div>
    </PublicPageShell>
  );
}
