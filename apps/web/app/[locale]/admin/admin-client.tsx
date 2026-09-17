'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { WaChatThread } from '@/components/commerce/WaChatThread';

type PendingListing = {
  id: string;
  slug: string;
  title: string;
  status: string;
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
};

type SubmittedPayment = {
  id: string;
  amount: number;
  currency: string;
  method?: string;
  order?: {
    id: string;
    publicId?: string;
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

type EscalatedChat = {
  publicId: string;
  listing: { id: string; slug: string; title: string; sellerName?: string | null };
  guestName?: string | null;
  guestPhone?: string | null;
  buyerLocale?: string | null;
  escalationStatus: string;
  escalationReason?: string | null;
  escalatedAt?: string | null;
  lastMessageAt?: string | null;
  messageCount: number;
  preview?: string | null;
};

type ChatMsg = {
  id: string;
  senderRole: string;
  text?: string;
  body: string;
  original?: string | null;
  sourceLang?: string | null;
  createdAt: string;
};

type ChatThreadView = {
  publicId: string;
  buyerLocale?: string | null;
  escalationStatus?: string;
  listing: { title: string; sellerName?: string | null };
  messages: ChatMsg[];
};

type AdminTab = 'home' | 'inbox' | 'listings' | 'payments' | 'leads' | 'catalog';

function flattenTaxon(nodes: TaxonNode[], depth = 0, acc: Array<TaxonNode & { depth: number }> = []) {
  for (const n of nodes || []) {
    acc.push({ ...n, depth });
    if (n.children?.length) flattenTaxon(n.children, depth + 1, acc);
  }
  return acc;
}

function reasonLabel(reason: string | null | undefined, copy: Record<string, string>) {
  if (reason === 'buyer_requested_admin') return copy.admin_chat_reason_admin || reason;
  if (reason === 'assistant_cannot_answer') return copy.admin_chat_reason_bot || reason;
  return reason || '—';
}

export default function AdminClient({ locale, copy }: { locale: Locale; copy: Record<string, string> }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<AdminTab>('home');
  const [pending, setPending] = useState<PendingListing[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payments, setPayments] = useState<SubmittedPayment[]>([]);
  const [chatThreads, setChatThreads] = useState<EscalatedChat[]>([]);
  const [activeChatId, setActiveChatId] = useState('');
  const [activeChat, setActiveChat] = useState<ChatThreadView | null>(null);
  const [chatReply, setChatReply] = useState('');
  const [categories, setCategories] = useState<TaxonNode[]>([]);
  const [taxCatId, setTaxCatId] = useState('');
  const [taxAttrs, setTaxAttrs] = useState<AttrDef[]>([]);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [seenChatIds, setSeenChatIds] = useState<string[]>([]);
  const notifyRef = useRef<HTMLDivElement | null>(null);
  const booted = useRef(false);

  const unreadChats = useMemo(
    () => chatThreads.filter((t) => !seenChatIds.includes(t.publicId)),
    [chatThreads, seenChatIds],
  );

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace(`/${locale}/login?next=/${locale}/admin`);
      return;
    }
    const me = await fetchMe();
    if (me.platformRole !== 'SUPER_ADMIN' && me.platformRole !== 'ADMIN' && me.platformRole !== 'SUPPORT') {
      setError(copy.admin_forbidden);
      setUser(me);
      return;
    }
    setUser(me);
    const [list, leadList, payList, cats, chats] = await Promise.all([
      apiAuthed<PendingListing[]>('/admin/listings/pending').catch(() => []),
      apiAuthed<Lead[]>('/professionals/leads').catch(() => []),
      apiAuthed<SubmittedPayment[]>('/admin/payments/submitted').catch(() => []),
      fetch(apiUrl('/categories?locale=' + locale)).then((r) => r.json()).catch(() => []),
      apiAuthed<EscalatedChat[]>('/chat/admin/threads?status=OPEN').catch(() => []),
    ]);
    const nextChats = Array.isArray(chats) ? chats : [];
    setPending(list || []);
    setLeads(leadList || []);
    setPayments(payList || []);
    setCategories(Array.isArray(cats) ? cats : []);
    setChatThreads(nextChats);

    if (!booted.current) {
      booted.current = true;
      if (nextChats.length > 0) setTab('inbox');
    }
  }, [copy.admin_forbidden, locale, router]);

  useEffect(() => {
    void load().catch(() => {
      clearTokens();
      router.replace(`/${locale}/login?next=/${locale}/admin`);
    });
  }, [load, locale, router]);

  // Soft poll so escalations show up as notifications without refresh.
  useEffect(() => {
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(id);
  }, [load]);

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

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!notifyRef.current?.contains(e.target as Node)) setNotifyOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

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

  async function openChat(publicId: string) {
    setTab('inbox');
    setNotifyOpen(false);
    setActiveChatId(publicId);
    setChatReply('');
    setSeenChatIds((prev) => (prev.includes(publicId) ? prev : [...prev, publicId]));
    setBusyId(publicId);
    try {
      const t = await apiAuthed<ChatThreadView>(`/chat/threads/${publicId}`);
      setActiveChat(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyId('');
    }
  }

  async function sendAdminChat() {
    if (!activeChatId || !chatReply.trim()) return;
    setBusyId(activeChatId);
    setError('');
    try {
      const res = await apiAuthed<{ thread: ChatThreadView }>(`/chat/threads/${activeChatId}/admin-messages`, {
        method: 'POST',
        json: { body: chatReply.trim() },
      });
      setActiveChat(res.thread);
      setChatReply('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyId('');
    }
  }

  async function resolveChat(publicId: string) {
    setBusyId(publicId);
    try {
      await apiAuthed(`/chat/threads/${publicId}/resolve`, { method: 'POST', json: {} });
      setMsg(copy.admin_chat_resolved);
      if (activeChatId === publicId) {
        setActiveChat(null);
        setActiveChatId('');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusyId('');
    }
  }

  function markAllSeen() {
    setSeenChatIds(chatThreads.map((t) => t.publicId));
  }

  if (!user) return <p className="pk-notice">{copy.panel_loading}</p>;

  const tabBtn = (id: AdminTab, label: string, count?: number) => (
    <button type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>
      {label}
      {count != null && count > 0 ? <span className="panel-badge panel-badge--danger">{count}</span> : null}
    </button>
  );

  return (
    <div className="panel-workspace admin-workspace">
      <header className="panel-header">
        <div>
          <strong>{copy.admin_panel_title}</strong>
          <div className="panel-header__meta">
            <span>
              {user.email} · {user.platformRole}
            </span>
            <div className="admin-notify" ref={notifyRef}>
              <button
                type="button"
                className="admin-notify__bell"
                aria-label={copy.admin_notify_title}
                onClick={() => {
                  setNotifyOpen((o) => !o);
                  if (!notifyOpen) markAllSeen();
                }}
              >
                🔔
                {unreadChats.length > 0 ? (
                  <span className="admin-notify__badge">{unreadChats.length > 9 ? '9+' : unreadChats.length}</span>
                ) : null}
              </button>
              {notifyOpen ? (
                <div className="admin-notify__panel" role="dialog">
                  <div className="admin-notify__head">
                    <strong>{copy.admin_notify_title}</strong>
                    <button type="button" className="btn ghost" onClick={() => setTab('inbox')}>
                      {copy.admin_tab_inbox}
                    </button>
                  </div>
                  {!chatThreads.length ? (
                    <p className="admin-notify__empty">{copy.admin_notify_empty}</p>
                  ) : (
                    <ul className="admin-notify__list">
                      {chatThreads.slice(0, 8).map((t) => (
                        <li key={t.publicId} className={seenChatIds.includes(t.publicId) ? '' : 'unread'}>
                          <button type="button" className="admin-notify__item" onClick={() => void openChat(t.publicId)}>
                            <span className="admin-notify__item-title">{t.listing.title}</span>
                            <span className="admin-notify__item-body">
                              {t.guestName || copy.chat_you} · {reasonLabel(t.escalationReason, copy)}
                            </span>
                            {t.preview ? <span className="admin-notify__item-body">{t.preview}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="panel-header__actions">
          <button type="button" className="btn ghost" onClick={() => void load()}>
            {copy.admin_refresh}
          </button>
          <a className="btn ghost" href={`/${locale}/seller`}>
            {copy.nav_sellers}
          </a>
          <button type="button" className="btn ghost" onClick={() => void logout().then(() => router.push(`/${locale}`))}>
            {copy.auth_logout}
          </button>
        </div>
      </header>

      <div className="panel-body">
        <nav className="panel-tabs" aria-label="admin">
          {tabBtn('home', copy.admin_tab_home)}
          {tabBtn('inbox', copy.admin_tab_inbox, chatThreads.length)}
          {tabBtn('listings', copy.admin_tab_listings, pending.length)}
          {tabBtn('payments', copy.admin_tab_payments, payments.length)}
          {tabBtn('leads', copy.admin_tab_leads, leads.length)}
          {tabBtn('catalog', copy.admin_tab_catalog)}
        </nav>

        {error ? <p className="panel-err">{error}</p> : null}
        {msg ? <p className="panel-ok">{msg}</p> : null}

        {tab === 'home' ? (
          <section className="panel-card">
            <h2>{copy.admin_home_title}</h2>
            <p className="panel-muted">{copy.admin_home_lead}</p>
            <div className="admin-stat-grid">
              <button type="button" className="admin-stat" onClick={() => setTab('inbox')}>
                <strong>{chatThreads.length}</strong>
                <span>{copy.admin_tab_inbox}</span>
              </button>
              <button type="button" className="admin-stat" onClick={() => setTab('listings')}>
                <strong>{pending.length}</strong>
                <span>{copy.admin_tab_listings}</span>
              </button>
              <button type="button" className="admin-stat" onClick={() => setTab('payments')}>
                <strong>{payments.length}</strong>
                <span>{copy.admin_tab_payments}</span>
              </button>
              <button type="button" className="admin-stat" onClick={() => setTab('leads')}>
                <strong>{leads.length}</strong>
                <span>{copy.admin_tab_leads}</span>
              </button>
            </div>
            {chatThreads[0] ? (
              <div className="admin-home-alert">
                <div>
                  <strong>{copy.admin_notify_new}</strong>
                  <p className="panel-muted">
                    {chatThreads[0].listing.title} — {chatThreads[0].guestName || 'buyer'}
                  </p>
                </div>
                <button type="button" className="mp-btn mp-btn--primary" onClick={() => void openChat(chatThreads[0].publicId)}>
                  {copy.chat_open}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'inbox' ? (
          <section className="panel-card admin-inbox">
            <h2>
              {copy.admin_chat_inbox}
              {chatThreads.length ? <span className="panel-badge panel-badge--danger">{chatThreads.length}</span> : null}
            </h2>
            {!chatThreads.length ? <p className="panel-muted">{copy.admin_chat_empty}</p> : null}
            <div className="wa-inbox">
              <div className="wa-inbox__list">
                <div className="wa-inbox__list-head">{copy.admin_tab_inbox}</div>
                {chatThreads.map((t) => (
                  <button
                    key={t.publicId}
                    type="button"
                    className={`wa-inbox__row${activeChatId === t.publicId ? ' is-active' : ''}`}
                    onClick={() => void openChat(t.publicId)}
                  >
                    <strong>{t.listing.title}</strong>
                    <span>
                      {t.guestName || 'buyer'}
                      {t.buyerLocale ? ` · ${t.buyerLocale}` : ''} · {reasonLabel(t.escalationReason, copy)}
                    </span>
                    {t.preview ? <em>{t.preview}</em> : null}
                  </button>
                ))}
              </div>
              <div className="wa-inbox__thread">
                {activeChat ? (
                  <WaChatThread
                    mode="staff"
                    title={activeChat.listing.title}
                    subtitle={[
                      activeChat.listing.sellerName || '',
                      activeChat.buyerLocale ? `${copy.chat_buyer_lang}: ${activeChat.buyerLocale}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    statusBadge={copy.chat_online}
                    messages={activeChat.messages}
                    roleLabel={(role) => {
                      const r = role.toUpperCase();
                      if (r === 'BUYER') return copy.chat_you || 'خریدار';
                      if (r === 'SELLER') return copy.chat_seller || 'فروشنده';
                      if (r === 'ASSISTANT') return copy.chat_assistant || 'دستیار';
                      if (r === 'ADMIN') return copy.chat_admin || 'ادمین';
                      return copy.chat_system || 'سیستم';
                    }}
                    originalLabel={copy.chat_staff_original}
                    value={chatReply}
                    onChange={setChatReply}
                    onSubmit={() => void sendAdminChat()}
                    placeholder={copy.admin_chat_reply}
                    sendLabel={copy.chat_send}
                    busy={!!busyId}
                    emptyLabel={copy.chat_empty}
                    headerActions={
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}
                        disabled={busyId === activeChat.publicId}
                        onClick={() => void resolveChat(activeChat.publicId)}
                      >
                        {copy.admin_chat_resolve}
                      </button>
                    }
                  />
                ) : (
                  <div className="wa-inbox__empty">
                    <p>{copy.admin_chat_pick}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'listings' ? (
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
                    {l.facility?.address?.city || '—'}
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
                    <button type="button" className="mp-btn mp-btn--primary" disabled={busyId === l.id} onClick={() => void act(l.id, 'approve')}>
                      {copy.admin_approve}
                    </button>
                    <button type="button" className="mp-btn" disabled={busyId === l.id} onClick={() => void act(l.id, 'publish')}>
                      {copy.admin_publish}
                    </button>
                    <button type="button" className="mp-btn" disabled={busyId === l.id} onClick={() => void act(l.id, 'reject')}>
                      {copy.admin_reject}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'payments' ? (
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
                    {p.order?.buyer?.name || 'Buyer'} → {p.order?.seller?.name || 'Seller'} ·{' '}
                    {p.order?.publicId || p.order?.id?.slice(-6)}
                  </p>
                  <button type="button" className="mp-btn mp-btn--primary" disabled={busyId === p.id} onClick={() => void confirmPay(p.id)}>
                    {copy.admin_confirm_payment}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'leads' ? (
          <section className="panel-card">
            <h2>
              {copy.admin_leads} ({leads.length})
            </h2>
            {!leads.length ? <p className="panel-muted">{copy.admin_leads_empty}</p> : null}
            <ul className="panel-list">
              {leads.map((lead) => (
                <li key={lead.publicId}>
                  <strong>{lead.contactName}</strong> · {lead.specialtyHints.join(', ') || '—'} · {lead.city || '—'} ·{' '}
                  {lead.status}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === 'catalog' ? (
          <section className="panel-card">
            <h2>{copy.admin_taxonomy}</h2>
            <p className="panel-muted">{copy.admin_taxonomy_lead}</p>
            <label>
              {copy.admin_taxonomy_pick}
              <select value={taxCatId} onChange={(e) => setTaxCatId(e.target.value)}>
                <option value="">{copy.seller_pick_category}</option>
                {flattenTaxon(categories).map((c) => (
                  <option key={c.id} value={c.id}>
                    {'—'.repeat(c.depth)} {locale === 'fa' ? c.nameFa || c.nameEn || c.name : c.nameEn || c.nameFa || c.name}
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
                  </li>
                ))}
                {!taxAttrs.length ? <li className="panel-muted">{copy.admin_taxonomy_no_attrs}</li> : null}
              </ul>
            ) : (
              <p className="panel-muted">{copy.admin_taxonomy_pick}</p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
