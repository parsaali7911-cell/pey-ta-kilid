'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n-public';

type ChatMessage = {
  id: string;
  senderRole: 'BUYER' | 'SELLER' | 'ASSISTANT' | 'ADMIN' | 'SYSTEM';
  text?: string;
  body: string;
  bodyFa?: string | null;
  bodyForBuyer?: string | null;
  sourceLang?: string | null;
  original?: string | null;
  createdAt: string;
};

type ChatThread = {
  publicId: string;
  guestToken?: string | null;
  guestName?: string | null;
  buyerLocale?: string | null;
  audience?: 'buyer' | 'staff';
  bilingual?: boolean;
  escalationStatus?: 'NONE' | 'OPEN' | 'RESOLVED';
  listing: { id: string; slug: string; title: string; sellerName?: string | null };
  messages: ChatMessage[];
};

const GUEST_KEY = 'peytakilid:listingChatGuest';

function loadGuest(): { name: string; phone: string; tokens: Record<string, string> } {
  if (typeof window === 'undefined') return { name: '', phone: '', tokens: {} };
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      tokens: parsed.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {},
    };
  } catch {
    return { name: '', phone: '', tokens: {} };
  }
}

function saveGuest(next: { name: string; phone: string; tokens: Record<string, string> }) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(next));
}

export function ListingChatPanel({
  locale,
  copy,
  listingSlug,
  sellerName,
}: {
  locale: Locale;
  copy: Record<string, string>;
  listingSlug: string;
  sellerName?: string | null;
}) {
  const [guest, setGuest] = useState(loadGuest);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const tokenForListing = guest.tokens[listingSlug] || '';

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const access = getAccessToken();
    if (access) h.Authorization = `Bearer ${access}`;
    return h;
  }, []);

  useEffect(() => {
    if (!open || !tokenForListing) return;
    void (async () => {
      try {
        const qs = new URLSearchParams({ guestToken: tokenForListing });
        const res = await fetch(apiUrl(`/chat/threads/${tokenForListing}?${qs}`), {
          headers: authHeaders,
        });
        // publicId is not guestToken — reload via start endpoint instead
      } catch {
        /* ignore */
      }
    })();
  }, [open, tokenForListing, authHeaders]);

  async function ensureThread(firstMessage?: string) {
    const access = getAccessToken();
    if (!access && guest.name.trim().length < 2) {
      throw new Error(copy.chat_guest_name_required || 'نام لازم است');
    }
    const res = await fetch(apiUrl(`/chat/listings/${encodeURIComponent(listingSlug)}/threads`), {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        guestName: access ? undefined : guest.name.trim(),
        guestPhone: access ? undefined : guest.phone.trim() || undefined,
        guestToken: tokenForListing || undefined,
        locale,
        message: firstMessage || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || copy.chat_failed || 'Failed');
    const t = data as ChatThread;
    setThread(t);
    if (t.guestToken) {
      const next = {
        ...guest,
        name: guest.name,
        phone: guest.phone,
        tokens: { ...guest.tokens, [listingSlug]: t.guestToken },
      };
      // Also store publicId mapping: reuse tokens map with publicId key
      next.tokens[`${listingSlug}:id`] = t.publicId;
      setGuest(next);
      saveGuest(next);
    } else if (t.publicId) {
      const next = {
        ...guest,
        tokens: { ...guest.tokens, [`${listingSlug}:id`]: t.publicId },
      };
      setGuest(next);
      saveGuest(next);
    }
    return t;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      if (!getAccessToken() && guest.name.trim().length >= 2) {
        saveGuest({ ...guest, name: guest.name.trim(), phone: guest.phone.trim() });
      }
      let current = thread;
      if (!current) {
        current = await ensureThread(body);
        setText('');
        return;
      }
      const res = await fetch(apiUrl(`/chat/threads/${current.publicId}/messages`), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          body,
          guestToken: current.guestToken || tokenForListing || undefined,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || copy.chat_failed || 'Failed');
      setThread(data.thread as ChatThread);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.chat_failed || 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function onOpen() {
    setOpen(true);
    setError('');
    if (thread) return;
    const publicId = guest.tokens[`${listingSlug}:id`];
    const gToken = guest.tokens[listingSlug];
    if (!publicId && !getAccessToken()) return;
    setBusy(true);
    try {
      if (publicId) {
        const qs = gToken ? `?guestToken=${encodeURIComponent(gToken)}` : '';
        const res = await fetch(apiUrl(`/chat/threads/${publicId}${qs}`), { headers: authHeaders });
        if (res.ok) {
          setThread((await res.json()) as ChatThread);
          return;
        }
      }
      if (getAccessToken()) {
        await ensureThread();
      }
    } catch {
      /* first open can be empty */
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = (role: ChatMessage['senderRole']) => {
    if (role === 'BUYER') return copy.chat_you || 'شما';
    if (role === 'SELLER') return sellerName || copy.chat_seller || 'فروشنده';
    if (role === 'ASSISTANT') return copy.chat_assistant || 'دستیار کالا';
    if (role === 'ADMIN') return copy.chat_admin || 'پشتیبانی سایت';
    return copy.chat_system || 'سیستم';
  };

  return (
    <div className="pk-chat">
      {!open ? (
        <button type="button" className="mp-btn mp-btn--primary pk-chat__open" onClick={() => void onOpen()}>
          {copy.chat_open || 'گفتگو درباره این کالا'}
        </button>
      ) : (
        <div className="pk-chat__panel">
          <div className="pk-chat__head">
            <strong>{copy.chat_title || 'گفتگوی کالا'}</strong>
            <span className="pk-chat__sub">
              {sellerName ? `${copy.chat_with_seller || 'با'} ${sellerName}` : copy.chat_title}
            </span>
            {thread?.escalationStatus === 'OPEN' ? (
              <span className="pk-chat__badge">{copy.chat_escalated_badge || 'متصل به پشتیبانی'}</span>
            ) : null}
          </div>

          {!getAccessToken() ? (
            <div className="pk-chat__guest">
              <label>
                {copy.chat_guest_name || 'نام شما'}
                <input
                  value={guest.name}
                  onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                  placeholder={copy.chat_guest_name_ph || 'مثلاً علی'}
                />
              </label>
              <label>
                {copy.chat_guest_phone || 'موبایل (اختیاری)'}
                <input
                  value={guest.phone}
                  onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                  placeholder="09…"
                />
              </label>
            </div>
          ) : null}

          <div className="pk-chat__msgs" aria-live="polite">
            {(thread?.messages || []).length === 0 ? (
              <p className="pk-chat__empty">{copy.chat_empty || 'اولین پیام را بنویسید — قیمت، موجودی یا سؤال…'}</p>
            ) : (
              thread!.messages.map((m) => (
                <div key={m.id} className={`pk-chat__bubble pk-chat__bubble--${m.senderRole.toLowerCase()}`}>
                  <span className="pk-chat__role">{roleLabel(m.senderRole)}</span>
                  <p>{m.text || m.body}</p>
                </div>
              ))
            )}
          </div>

          <form className="pk-chat__form" onSubmit={onSubmit}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={copy.chat_placeholder || 'پیام خود را بنویسید…'}
              disabled={busy}
            />
            <button type="submit" className="mp-btn mp-btn--primary" disabled={busy || !text.trim()}>
              {busy ? '…' : copy.chat_send || 'ارسال'}
            </button>
          </form>
          {error ? <p className="pk-chat__err">{error}</p> : null}
          <p className="pk-chat__hint">
            {locale === 'fa'
              ? copy.chat_hint ||
                'اول دستیار جواب می‌دهد؛ در صورت نیاز ادمین وصل می‌شود. پیام غیر فارسی برای تیم ترجمه می‌شود.'
              : copy.chat_hint_i18n ||
                'Write in your language — the team reads Persian via translation; you see replies in your language.'}
          </p>
        </div>
      )}
    </div>
  );
}
