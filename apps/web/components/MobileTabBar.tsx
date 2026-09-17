'use client';

import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n-public';

type Copy = Record<string, string>;

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}
function IconCatalog() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.5 16.5 20 20" strokeLinecap="round" />
    </svg>
  );
}
function IconPros() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.5 19" strokeLinecap="round" />
      <path d="M14.2 14.2c1.5-.5 3.2-.3 4.8 1.1.6.5 1.1 1.3 1.3 2.2" strokeLinecap="round" />
    </svg>
  );
}
function IconDesign() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="M7 19V9.5L12 5l5 4.5V19" strokeLinejoin="round" />
      <path d="M10 19v-4h4v4" />
    </svg>
  );
}

export function MobileTabBar({ locale, copy }: { locale: Locale; copy: Copy }) {
  const pathname = usePathname() || '';

  const items = [
    { href: `/${locale}`, label: copy.nav_home || copy.brand, match: 'home', Icon: IconHome },
    { href: `/${locale}/catalog`, label: copy.nav_catalog, match: 'catalog', Icon: IconCatalog },
    { href: `/${locale}/search`, label: copy.nav_search, match: 'search', Icon: IconSearch },
    {
      href: `/${locale}/professionals`,
      label: copy.mp_quick_pros || copy.nav_professionals,
      match: 'professionals',
      Icon: IconPros,
    },
    { href: `/${locale}/designer`, label: copy.nav_design, match: 'designer', Icon: IconDesign },
  ] as const;

  function isActive(match: (typeof items)[number]['match']) {
    if (match === 'home') return pathname === `/${locale}` || pathname === `/${locale}/`;
    return pathname === `/${locale}/${match}` || pathname.startsWith(`/${locale}/${match}/`);
  }

  return (
    <nav className="pk-tabbar" aria-label={copy.nav_primary || 'Primary'}>
      {items.map(({ href, label, match, Icon }) => (
        <a
          key={href}
          href={href}
          className={`pk-tabbar__item${isActive(match) ? ' is-active' : ''}`}
          aria-current={isActive(match) ? 'page' : undefined}
        >
          <Icon />
          <span className="pk-tabbar__label">{label}</span>
        </a>
      ))}
    </nav>
  );
}
