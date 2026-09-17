'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { BrandLogo } from '@/components/BrandLogo';
import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import type { Locale } from '@/lib/i18n-public';

type Copy = Record<string, string>;

export function PublicHeader({ locale, copy }: { locale: Locale; copy: Copy }) {
  const pathname = usePathname() || '';
  const isHome = pathname === `/${locale}` || pathname === `/${locale}/`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      document.body.style.removeProperty('overflow');
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.removeProperty('overflow');
    };
  }, [open]);

  const primary = [
    { href: `/${locale}/catalog`, label: copy.nav_catalog },
    { href: `/${locale}/search`, label: copy.nav_search },
    { href: `/${locale}/projects`, label: copy.nav_projects },
    { href: `/${locale}/professionals`, label: copy.nav_professionals },
    { href: `/${locale}/designer`, label: copy.nav_design },
    { href: `/${locale}/buyer`, label: copy.nav_buyer_panel },
    { href: `/${locale}/seller`, label: copy.nav_seller_panel },
    { href: `/${locale}/admin`, label: copy.nav_admin },
  ];

  const headerClass = isHome
    ? 'site-header public-header site-header--marketplace site-header--with-search'
    : 'site-header public-header site-header--solid site-header--with-search';

  return (
    <header className={headerClass}>
      <div className="header-top-row">
        <BrandLogo href={`/${locale}`} label={copy.brand} />

        <div className="header-search-slot header-search-slot--desktop">
          <SiteSearchBar locale={locale} copy={copy} variant="header" />
        </div>

        <div className="header-actions">
          <a className="header-supplier-link" href={`/${locale}/register?intent=seller`}>
            {copy.nav_sellers}
          </a>
          <a className="header-supplier-link" href={`/${locale}/login`}>
            {copy.auth_login_cta}
          </a>
          <LanguageSwitcher locale={locale} />
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? copy.nav_close : copy.nav_menu}
          </button>
        </div>
      </div>

      <div className="header-search-slot header-search-slot--mobile">
        <SiteSearchBar locale={locale} copy={copy} variant="header" />
      </div>

      <nav className="nav-desktop nav-desktop--center" aria-label={copy.nav_primary}>
        {primary.map((item) => (
          <a key={item.href + item.label} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      {open ? (
        <div id="mobile-nav" className="nav-drawer">
          <div className="nav-drawer__langs">
            <LanguageSwitcher locale={locale} variant="drawer" />
          </div>
          <a
            className="header-supplier-link"
            href={`/${locale}/register?intent=seller`}
            onClick={() => setOpen(false)}
          >
            {copy.nav_sellers}
          </a>
          <a className="header-supplier-link" href={`/${locale}/login`} onClick={() => setOpen(false)}>
            {copy.auth_login_cta}
          </a>
          {primary.map((item) => (
            <a key={item.href + item.label} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
    </header>
  );
}
