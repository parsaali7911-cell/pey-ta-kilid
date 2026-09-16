import { notFound } from 'next/navigation';
import { PublicPageShell } from '@/components/PublicPageShell';
import { isLocale, t } from '@/lib/i18n-public';
import { RegisterClient } from './register-client';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const sp = await searchParams;
  const copy = t(raw);
  const intent =
    sp.intent === 'professional' || sp.intent === 'buyer' || sp.intent === 'seller'
      ? sp.intent
      : 'seller';

  return (
    <PublicPageShell
      locale={raw}
      kicker={copy.auth_kicker}
      title={copy.auth_register_title}
      lead={
        intent === 'professional'
          ? copy.auth_register_lead_pro
          : intent === 'buyer'
            ? copy.auth_register_lead_buyer
            : copy.auth_register_lead_seller
      }
    >
      <div className="panel-workspace" style={{ padding: '1.25rem' }}>
        <div className="panel-intent-tabs">
          <a className={intent === 'seller' ? 'is-active' : ''} href={`/${raw}/register?intent=seller`}>
            {copy.role_seller}
          </a>
          <a
            className={intent === 'professional' ? 'is-active' : ''}
            href={`/${raw}/register?intent=professional`}
          >
            {copy.role_professional}
          </a>
          <a className={intent === 'buyer' ? 'is-active' : ''} href={`/${raw}/register?intent=buyer`}>
            {copy.role_buyer}
          </a>
        </div>
        <RegisterClient locale={raw} copy={copy} intent={intent} />
      </div>
    </PublicPageShell>
  );
}
