'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiAuthed,
  clearTokens,
  fetchMe,
  getAccessToken,
  logout,
  type AuthUser,
} from '@/lib/auth-client';
import { apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';

type PendingListing = {
  id: string;
  slug: string;
  title: string;
  status: string;
  submittedAt?: string | null;
  organization?: { name?: string; slug?: string } | null;
  category?: { nameEn?: string; nameFa?: string; slug?: string } | null;
  facility?: { name?: string; address?: { city?: string } } | null;
  price?: { displayPrice?: number; currency?: string } | null;
};

type Lead = {
  publicId: string;
  contactName: string;
  specialtyHints: string[];
  city?: string | null;
  status: string;
  createdAt: number;
  notes?: string | null;
};

type AiStatus = {
  provider: string;
  translation?: { locales: string[]; fields: string[] };
  capabilities?: Record<string, string>;
  note?: string;
};

type SubmittedPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  order?: {
    id: string;
    publicId?: string;
    totalDisplayPrice?: number;
    buyer?: { name?: string };
    seller?: { name?: string };
  };
};

type TaxonNode = {
  id: string;
  slug: string;
  nameEn?: string;
  nameFa?: string;
  name?: string;
  children?: TaxonNode[];
};
type AttrDef = { id: string; code: string; dataType: string; required?: boolean; nameEn?: string; unit?: string | null };

function flattenTaxon(nodes: TaxonNode[], depth = 0, acc: Array<TaxonNode & { depth: number }> = []) {
  for (const n of nodes || []) {
    acc.push({ ...n, depth });
    if (n.children?.length) flattenTaxon(n.children, depth + 1, acc);
  }
  return acc;
}

export default function AdminClient({ locale, copy }: { locale: Locale; copy: Record<string, string> }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payments, setPayments] = useState<SubmittedPayment[]>([]);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [categories, setCategories] = useState<TaxonNode[]>([]);
  const [taxCatId, setTaxCatId] = useState('');
  const [taxAttrs, setTaxAttrs] = useState<AttrDef[]>([]);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace(`/${locale}/login?next=/${locale}/admin`);
      return;
    }
    const me = await fetchMe();
    if (me.platformRole !== 'SUPER_ADMIN' && me.platformRole !== 'ADMIN') {
      setError(copy.admin_forbidden);
      setUser(me);
      return;
    }
    setUser(me);
    const [list, leadList, payList, aiStatus, cats] = await Promise.all([
      apiAuthed<PendingListing[]>('/admin/listings/pending'),
      apiAuthed<Lead[]>('/professionals/leads').catch(() => []),
      apiAuthed<SubmittedPayment[]>('/admin/payments/submitted').catch(() => []),
      fetch(apiUrl('/ai/status')).then((r) => r.json()),
      fetch(apiUrl('/categories?locale=' + locale)).then((r) => r.json()),
    ]);
    setPending(list || []);
    setLeads(leadList || []);
    setPayments(payList || []);
    setAi(aiStatus);
    setCategories(Array.isArray(cats) ? cats : []);
  }, [copy.admin_forbidden, locale, router]);

  useEffect(() => {
    void load().catch(() => {
      clearTokens();
      router.replace(`/${locale}/login?next=/${locale}/admin`);
    });
  }, [load, locale, router]);

  useEffect(() => {
    if (!taxCatId) {
      setTaxAttrs([]);
      return;
    }
    void fetch(apiUrl(`/categories/${taxCatId}/attributes`))
      .then((r) => r.json())
      .then((rows) => setTaxAttrs(Array.isArray(rows) ? rows : []))
      .catch(() => setTaxAttrs([]));
  }, [taxCatId]);

  async function confirmPay(id: string) {
    setBusyId(id);
    setError('');
    setMsg('');
    try {
      await apiAuthed(`/admin/payments/${id}/confirm`, { method: 'POST' });
      setMsg(copy.admin_payment_confirmed);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyId('');
    }
  }

  async function act(id: string, action: 'approve' | 'publish' | 'reject') {
    setBusyId(id);
    setError('');
    setMsg('');
    try {
      if (action === 'reject') {
        const reason = rejectReasons[id]?.trim();
        if (!reason) throw new Error(copy.admin_reject_required);
        await apiAuthed(`/admin/listings/${id}/reject`, { method: 'POST', json: { reason } });
      } else {
        await apiAuthed(`/admin/listings/${id}/${action}`, { method: 'POST', json: {} });
      }
      setMsg(copy.admin_done);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyId('');
    }
  }

  if (!user) return <p className="pk-notice">{copy.panel_loading}</p>;

  return (
    <div className="panel-workspace">
      <header className="panel-header">
        <div>
          <strong>{copy.admin_panel_title}</strong>
          <div className="panel-header__meta">
            {user.email} · {user.platformRole}
          </div>
        </div>
        <div className="panel-header__actions">
          <a className="btn ghost" href={`/${locale}/seller`}>
            {copy.nav_sellers}
          </a>
          <button type="button" className="btn ghost" onClick={() => void logout().then(() => router.push(`/${locale}`))}>
            {copy.auth_logout}
          </button>
        </div>
      </header>

      <div className="panel-body">
        {error ? <p className="panel-err">{error}</p> : null}
        {msg ? <p className="panel-ok">{msg}</p> : null}

        <section className="panel-card">
          <h2>{copy.admin_market_control}</h2>
          <p className="panel-muted">{copy.admin_market_lead}</p>
          <ol className="panel-steps">
            <li>{copy.admin_step_1}</li>
            <li>{copy.admin_step_2}</li>
            <li>{copy.admin_step_3}</li>
            <li>{copy.admin_step_4}</li>
          </ol>
        </section>

        <section className="panel-card">
          <h2>{copy.admin_ai_title}</h2>
          <p className="panel-muted">{copy.admin_ai_lead}</p>
          <ul className="panel-list">
            <li>
              <strong>Provider:</strong> {ai?.provider || '—'}
            </li>
            <li>
              <strong>Locales:</strong> {(ai?.translation?.locales || []).join(', ')}
            </li>
            <li>
              <strong>Fields:</strong> {(ai?.translation?.fields || []).join(', ')}
            </li>
            {ai?.capabilities
              ? Object.entries(ai.capabilities).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}:</strong> {v}
                  </li>
                ))
              : null}
            <li>{ai?.note}</li>
          </ul>
          <p className="panel-muted">{copy.admin_ai_intent_note}</p>
        </section>

        <section className="panel-card">
          <h2>{copy.admin_taxonomy}</h2>
          <p className="panel-muted">{copy.admin_taxonomy_lead}</p>
          <label>
            {copy.admin_taxonomy_pick}
            <select value={taxCatId} onChange={(e) => setTaxCatId(e.target.value)}>
              <option value="">{copy.seller_pick_category}</option>
              {flattenTaxon(categories).map((c) => (
                <option key={c.id} value={c.id}>
                  {'—'.repeat(c.depth)} {locale === 'fa' ? c.nameFa || c.nameEn || c.name : c.nameEn || c.nameFa || c.name} (
                  {c.slug})
                </option>
              ))}
            </select>
          </label>
          {taxCatId ? (
            <ul className="panel-list">
              {taxAttrs.map((a) => (
                <li key={a.id}>
                  <strong>{a.code}</strong> · {a.dataType}
                  {a.required ? ' · required' : ''}
                  {a.unit ? ` · ${a.unit}` : ''}
                  {a.nameEn ? ` · ${a.nameEn}` : ''}
                </li>
              ))}
              {!taxAttrs.length ? <li className="panel-muted">{copy.admin_taxonomy_no_attrs}</li> : null}
            </ul>
          ) : (
            <ul className="panel-list">
              {flattenTaxon(categories)
                .slice(0, 40)
                .map((c) => (
                  <li key={c.id}>
                    {'—'.repeat(c.depth)}{' '}
                    {locale === 'fa' ? c.nameFa || c.nameEn || c.name : c.nameEn || c.nameFa || c.name} · {c.slug}
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="panel-card">
          <h2>
            {copy.admin_pending} ({pending.length})
          </h2>
          {!pending.length ? <p className="panel-muted">{copy.admin_no_pending}</p> : null}
          <div className="panel-stack">
            {pending.map((l) => (
              <article key={l.id} className="panel-item">
                <h3>{l.title}</h3>
                <p className="panel-muted">
                  {l.organization?.name} · {l.category?.nameFa || l.category?.nameEn || l.category?.slug} ·{' '}
                  {l.facility?.address?.city || '—'} · {l.slug}
                </p>
                {l.price?.displayPrice != null ? (
                  <p>
                    {copy.mp_from} {l.price.displayPrice} {l.price.currency}
                  </p>
                ) : null}
                <label>
                  {copy.admin_reject_reason}
                  <input
                    value={rejectReasons[l.id] || ''}
                    onChange={(e) => setRejectReasons((s) => ({ ...s, [l.id]: e.target.value }))}
                  />
                </label>
                <div className="designer-actions">
                  <button
                    type="button"
                    className="mp-btn mp-btn--primary"
                    disabled={busyId === l.id}
                    onClick={() => void act(l.id, 'approve')}
                  >
                    {copy.admin_approve}
                  </button>
                  <button
                    type="button"
                    className="mp-btn"
                    disabled={busyId === l.id}
                    onClick={() => void act(l.id, 'publish')}
                  >
                    {copy.admin_publish}
                  </button>
                  <button
                    type="button"
                    className="mp-btn"
                    disabled={busyId === l.id}
                    onClick={() => void act(l.id, 'reject')}
                  >
                    {copy.admin_reject}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <h2>
            {copy.admin_payments} ({payments.length})
          </h2>
          {!payments.length ? <p className="panel-muted">{copy.admin_no_payments}</p> : null}
          <div className="panel-stack">
            {payments.map((p) => (
              <article key={p.id} className="panel-item">
                <h3>
                  {p.amount} {p.currency} · {p.method || 'BANK_TRANSFER'}
                </h3>
                <p className="panel-muted">
                  {p.order?.buyer?.name || 'Buyer'} → {p.order?.seller?.name || 'Seller'} · order{' '}
                  {p.order?.publicId || p.order?.id?.slice(-6)}
                </p>
                <button
                  type="button"
                  className="mp-btn mp-btn--primary"
                  disabled={busyId === p.id}
                  onClick={() => void confirmPay(p.id)}
                >
                  {copy.admin_confirm_payment}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <h2>
            {copy.admin_leads} ({leads.length})
          </h2>
          <ul className="panel-list">
            {leads.map((lead) => (
              <li key={lead.publicId}>
                <strong>{lead.contactName}</strong> · {lead.specialtyHints.join(', ') || '—'} · {lead.city || '—'} ·{' '}
                {lead.status}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
