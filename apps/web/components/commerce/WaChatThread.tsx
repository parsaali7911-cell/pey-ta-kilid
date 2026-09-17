'use client';

import { FormEvent, ReactNode, useEffect, useRef } from 'react';

export type WaChatMessage = {
  id: string;
  senderRole: string;
  text?: string;
  body: string;
  original?: string | null;
  sourceLang?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaMime?: string | null;
  createdAt?: string;
};

function formatTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function sideFor(role: string, mode: 'buyer' | 'staff') {
  const r = role.toUpperCase();
  if (r === 'SYSTEM') return 'system';
  if (mode === 'buyer') return r === 'BUYER' ? 'out' : 'in';
  return r === 'BUYER' ? 'in' : r === 'ASSISTANT' ? 'in' : 'out';
}

export function WaChatThread({
  mode,
  title,
  subtitle,
  avatarUrl,
  statusBadge,
  messages,
  roleLabel,
  originalLabel,
  value,
  onChange,
  onSubmit,
  onPickMedia,
  placeholder,
  sendLabel,
  attachLabel,
  busy,
  emptyLabel,
  error,
  footerHint,
  headerActions,
  topSlot,
}: {
  mode: 'buyer' | 'staff';
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  statusBadge?: string | null;
  messages: WaChatMessage[];
  roleLabel: (role: string) => string;
  originalLabel?: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onPickMedia?: (file: File) => void;
  placeholder: string;
  sendLabel: string;
  attachLabel?: string;
  busy?: boolean;
  emptyLabel?: string;
  error?: string;
  footerHint?: string;
  headerActions?: ReactNode;
  topSlot?: ReactNode;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, messages[messages.length - 1]?.id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    onSubmit();
  }

  return (
    <div className={`wa-chat wa-chat--${mode}`}>
      <header className="wa-chat__head">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="wa-chat__avatar-img" src={avatarUrl} alt="" />
        ) : (
          <div className="wa-chat__avatar" aria-hidden>
            {(title || '?').trim().slice(0, 1)}
          </div>
        )}
        <div className="wa-chat__head-main">
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        {statusBadge ? <span className="wa-chat__online">{statusBadge}</span> : null}
        {headerActions}
      </header>

      {topSlot}

      <div className="wa-chat__stage" aria-live="polite">
        {!messages.length ? <p className="wa-chat__empty">{emptyLabel || '…'}</p> : null}
        {messages.map((m) => {
          const side = sideFor(m.senderRole, mode);
          const mediaSrc = m.mediaUrl || '';
          return (
            <div key={m.id} className={`wa-bubble wa-bubble--${side} wa-bubble--${m.senderRole.toLowerCase()}`}>
              {side !== 'system' ? <span className="wa-bubble__name">{roleLabel(m.senderRole)}</span> : null}
              {m.mediaType === 'IMAGE' && mediaSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="wa-bubble__media" src={mediaSrc} alt="" />
              ) : null}
              {m.mediaType === 'VIDEO' && mediaSrc ? (
                <video className="wa-bubble__media" src={mediaSrc} controls playsInline preload="metadata" />
              ) : null}
              {(m.text || m.body) && !(m.mediaUrl && !(m.text || m.body).trim()) ? (
                <p className="wa-bubble__text">{m.text || m.body}</p>
              ) : m.mediaUrl ? null : (
                <p className="wa-bubble__text">{m.text || m.body}</p>
              )}
              {m.original ? (
                <p className="wa-bubble__original">
                  <span>{originalLabel || 'Original'}</span>
                  {m.original}
                </p>
              ) : null}
              <time className="wa-bubble__time">{formatTime(m.createdAt)}</time>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error ? <p className="wa-chat__err">{error}</p> : null}

      <form className="wa-chat__composer" onSubmit={submit}>
        {onPickMedia ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) onPickMedia(f);
              }}
            />
            <button
              type="button"
              className="wa-chat__attach"
              aria-label={attachLabel || 'Attach'}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              ＋
            </button>
          </>
        ) : null}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          placeholder={placeholder}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (value.trim() && !busy) onSubmit();
            }
          }}
        />
        <button type="submit" className="wa-chat__send" disabled={busy || !value.trim()} aria-label={sendLabel}>
          ➤
        </button>
      </form>
      {footerHint ? <p className="wa-chat__hint">{footerHint}</p> : null}
    </div>
  );
}
