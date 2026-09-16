'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LOCALES, t, type Locale } from '@/lib/i18n-public';

const SHORT: Record<Locale, string> = { fa: 'FA', en: 'EN', ar: 'AR' };

export function LanguageSwitcher({
  locale,
  variant = 'header',
}: {
  locale: Locale;
  variant?: 'header' | 'drawer';
}) {
  const pathname = usePathname() || `/${locale}`;
  const copy = t(locale);
  const rest = pathname.replace(/^\/(fa|en|ar)/, '') || '';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`lang-switch lang-switch--${variant}${open ? ' is-open' : ''}`}
    >
      <button
        type="button"
        className="lang-switch__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lang-switch__code">{SHORT[locale]}</span>
        <span className="lang-switch__name">
          {locale === 'fa' ? copy.lang_fa : locale === 'ar' ? copy.lang_ar : copy.lang_en}
        </span>
        <span className="lang-switch__chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul id={listId} className="lang-switch__menu" role="listbox" aria-label="Language">
          {LOCALES.map((code) => (
            <li key={code} role="option" aria-selected={code === locale}>
              <a
                href={`/${code}${rest}`}
                onClick={() => {
                  document.cookie = `peytakilid_locale=${code};path=/;max-age=31536000`;
                  setOpen(false);
                }}
              >
                <strong>{SHORT[code]}</strong>
                <span>
                  {code === 'fa' ? copy.lang_fa : code === 'ar' ? copy.lang_ar : copy.lang_en}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
