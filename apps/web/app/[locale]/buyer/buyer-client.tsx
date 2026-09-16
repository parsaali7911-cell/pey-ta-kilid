'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiAuthed,
  clearTokens,
  fetchMe,
  getAccessToken,
  logout,
  type AuthUser,
} from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n-public';

type Org = { id: string; name: string; slug: string; canBuy?: boolean; canSell?: boolean };
type Rfq = {
  id: string;
  publicId?: string;
  status: string;
  submittedAt?: string | null;
  items?: Array<{
    id: string;
    listingId?: string | null;
    titleSnapshot?: string | null;
    quantity: number;
    uomCode: string;
  }>;
  targets?: Array<{ id: string; sellerOrganizationId: string; listingId?: string | null }>;
};
type Quote = {
  id: string;
  status: string;
  rfqId: string;
  totalDisplayPrice?: number;
  currency?: string;
  seller?: { name?: string };
  items?: Array<{ titleSnapshot?: string | null; quantity: number; displayPrice?: number }>;
};
type Order = {
  id: string;
  status: string;
  totalDisplayPrice: number;
  currency: string;
  seller?: { name?: string };
  quoteId?: string;
  rfqId?: string;
  payments?: Array<{ id: string; status: string; amount: number }>;
};

export default function BuyerClient({
  locale,
  copy,
  initialTab = 'rfqs',
  highlightId = '',
}: {
  locale: Locale;
  copy: Record<string, string>;
  initialTab?: string;
  highlightId?: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState('');
  const [tab, setTab] = useState<'rfqs' | 'quotes' | 'orders' | 'org'>(
    initialTab === 'quotes' || initialTab === 'orders' || initialTab === 'org' ? initialTab : 'rfqs',
  );
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [quotesByRfq, setQuotesByRfq] = useState<Record<string, Quote[]>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace(`/${locale}/login?next=/${locale}/buyer`);
      return;
    }
    const me = await fetchMe();
    setUser(me);
    const memberships = await apiAuthed<Array<{ organization: Org }>>('/organizations');
    const list = (memberships || []).map((m) => m.organization).filter((o) => o.canBuy !== false);
    setOrgs(list);
    const preferred = list.find((o) => o.id === orgId) || list[0];
    if (preferred) setOrgId(preferred.id);
  }, [locale, orgId, router]);

  const loadCommerce = useCallback(
    async (id: string) => {
      if (!id) return;
      const [rfqList, orderList] = await Promise.all([
        apiAuthed<Rfq[]>(`/buyer/rfqs?organizationId=${encodeURIComponent(id)}`),
        apiAuthed<Order[]>(`/buyer/orders?organizationId=${encodeURIComponent(id)}`),
      ]);
      setRfqs(rfqList || []);
      setOrders(orderList || []);
      const map: Record<string, Quote[]> = {};
      for (const rfq of rfqList || []) {
        if (rfq.status === 'DRAFT') continue;
        try {
          map[rfq.id] = await apiAuthed<Quote[]>(`/buyer/rfqs/${rfq.id}/quotes`);
        } catch {
          map[rfq.id] = [];
        }
      }
      setQuotesByRfq(map);
    },
    [],
  );

  useEffect(() => {
    void load().catch(() => {
      clearTokens();
      router.replace(`/${locale}/login?next=/${locale}/buyer`);
    });
  }, [load, locale, router]);

  useEffect(() => {
    if (orgId) void loadCommerce(orgId).catch((e) => setError(String(e.message || e)));
  }, [orgId, loadCommerce]);

  async function createOrg(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const org = await apiAuthed<Org>('/organizations', {
        method: 'POST',
        json: {
          name: orgName.trim(),
          slug: (orgSlug || orgName)
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-|-$/g, ''),
          canBuy: true,
          canSell: false,
          isProfessional: false,
        },
      });
      setMsg(copy.buyer_org_created);
      setOrgName('');
      setOrgSlug('');
      await load();
      setOrgId(org.id);
      setTab('rfqs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function acceptQuote(quoteId: string) {
    setBusy(true);
    setError('');
    try {
      await apiAuthed(`/buyer/quotes/${quoteId}/accept`, { method: 'POST' });
      setMsg(copy.buyer_quote_accepted);
      await loadCommerce(orgId);
      setTab('orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function rejectQuote(quoteId: string) {
    setBusy(true);
    setError('');
    try {
      await apiAuthed(`/buyer/quotes/${quoteId}/reject`, { method: 'POST' });
      setMsg(copy.buyer_quote_rejected);
      await loadCommerce(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function payOrder(order: Order) {
    setBusy(true);
    setError('');
    try {
      await apiAuthed('/buyer/payments/submit', {
        method: 'POST',
        json: {
          orderId: order.id,
          amount: order.totalDisplayPrice,
          method: 'BANK_TRANSFER',
          idempotencyKey: `pay-${order.id}-full`,
          reference: `manual-${order.id.slice(-6)}`,
        },
      });
      setMsg(copy.buyer_payment_submitted);
      await loadCommerce(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  function canPay(order: Order) {
    if (!['AWAITING_PAYMENT', 'PARTIALLY_PAID', 'CONFIRMED'].includes(order.status)) return false;
    const open = (order.payments || []).some((p) => p.status === 'SUBMITTED' || p.status === 'PENDING');
    return !open;
  }

  function paymentLabel(order: Order) {
    const latest = (order.payments || [])[0];
    if (!latest) return null;
    if (latest.status === 'SUBMITTED' || latest.status === 'PENDING') return copy.buyer_payment_pending;
    if (latest.status === 'CONFIRMED') return copy.buyer_payment_confirmed_label;
    return latest.status;
  }

  if (!user) return <p className="pk-notice">{copy.panel_loading}</p>;

  return (
    <div className="panel-workspace">
      <header className="panel-header">
        <div>
          <strong>{copy.buyer_panel_title}</strong>
          <div className="panel-header__meta">
            {user.fullName || user.email} · {user.platformRole}
          </div>
        </div>
        <div className="panel-header__actions">
          <a className="btn ghost" href={`/${locale}/catalog`}>
            {copy.nav_catalog}
          </a>
          <button type="button" className="btn ghost" onClick={() => void logout().then(() => router.push(`/${locale}`))}>
            {copy.auth_logout}
          </button>
        </div>
      </header>

      <div className="panel-body">
        {error ? <p className="panel-err">{error}</p> : null}
        {msg ? <p className="panel-ok">{msg}</p> : null}

        <nav className="panel-tabs">
          {(
            [
              ['rfqs', copy.buyer_tab_rfqs],
              ['quotes', copy.buyer_tab_quotes],
              ['orders', copy.buyer_tab_orders],
              ['org', copy.buyer_tab_org],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>

        {orgs.length ? (
          <label>
            {copy.buyer_active_org}
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="panel-muted">{copy.buyer_need_org}</p>
        )}

        {tab === 'org' ? (
          <section className="panel-card">
            <h2>{copy.buyer_create_org}</h2>
            <form className="panel-form" onSubmit={createOrg}>
              <label>
                {copy.seller_org_name}
                <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </label>
              <label>
                {copy.seller_org_slug}
                <input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} placeholder="my-project" />
              </label>
              <button className="mp-btn mp-btn--primary" type="submit" disabled={busy}>
                {copy.buyer_create_org_cta}
              </button>
            </form>
          </section>
        ) : null}

        {tab === 'rfqs' ? (
          <section className="panel-card">
            <h2>{copy.buyer_rfqs}</h2>
            <p className="panel-muted">{copy.buyer_rfqs_lead}</p>
            <ul className="panel-list">
              {rfqs.map((r) => (
                <li key={r.id} className={highlightId === r.id ? 'is-highlight' : undefined}>
                  <strong>{r.status}</strong> · {r.publicId || r.id.slice(-8)}
                  {r.submittedAt ? (
                    <span className="panel-muted"> · {new Date(r.submittedAt).toLocaleString(locale)}</span>
                  ) : null}
                  <div className="panel-muted">
                    {(r.items || []).map((i) => `${i.titleSnapshot || i.listingId} × ${i.quantity} ${i.uomCode}`).join(' · ') ||
                      copy.buyer_no_rfqs}
                  </div>
                  {(quotesByRfq[r.id] || []).length ? (
                    <div>
                      {copy.buyer_quotes_for_rfq}:{' '}
                      {(quotesByRfq[r.id] || [])
                        .map((q) => `${q.status}${q.totalDisplayPrice != null ? ` (${q.totalDisplayPrice} ${q.currency || ''})` : ''}`)
                        .join(', ')}
                    </div>
                  ) : (
                    <div className="panel-muted">{copy.buyer_waiting_quotes}</div>
                  )}
                </li>
              ))}
            </ul>
            {!rfqs.length ? <p className="panel-muted">{copy.buyer_no_rfqs}</p> : null}
            <a className="mp-btn" href={`/${locale}/catalog`}>
              {copy.buyer_go_catalog}
            </a>
          </section>
        ) : null}

        {tab === 'quotes' ? (
          <section className="panel-card">
            <h2>{copy.buyer_incoming_quotes}</h2>
            <div className="panel-stack">
              {Object.entries(quotesByRfq).flatMap(([rfqId, quotes]) =>
                quotes.map((q) => (
                  <article key={q.id} className="panel-item">
                    <h3>
                      {q.seller?.name || 'Seller'} · {q.status}
                    </h3>
                    <p>
                      {q.totalDisplayPrice} {q.currency} · RFQ {rfqId.slice(-6)}
                    </p>
                    {q.status === 'SUBMITTED' ? (
                      <div className="designer-actions">
                        <button
                          type="button"
                          className="mp-btn mp-btn--primary"
                          disabled={busy}
                          onClick={() => void acceptQuote(q.id)}
                        >
                          {copy.buyer_accept_quote}
                        </button>
                        <button type="button" className="mp-btn" disabled={busy} onClick={() => void rejectQuote(q.id)}>
                          {copy.buyer_reject_quote}
                        </button>
                      </div>
                    ) : null}
                  </article>
                )),
              )}
            </div>
            {!Object.values(quotesByRfq).flat().length ? <p className="panel-muted">{copy.buyer_no_quotes}</p> : null}
          </section>
        ) : null}

        {tab === 'orders' ? (
          <section className="panel-card">
            <h2>{copy.buyer_orders}</h2>
            <div className="panel-stack">
              {orders.map((o) => (
                <article key={o.id} className="panel-item">
                  <h3>
                    {o.seller?.name || 'Seller'} · {o.status}
                  </h3>
                  <p>
                    {o.totalDisplayPrice} {o.currency}
                  </p>
                  {paymentLabel(o) ? <p className="panel-muted">{paymentLabel(o)}</p> : null}
                  {canPay(o) ? (
                    <button type="button" className="mp-btn mp-btn--primary" disabled={busy} onClick={() => void payOrder(o)}>
                      {copy.buyer_pay_now}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
            {!orders.length ? <p className="panel-muted">{copy.buyer_no_orders}</p> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
