'use client';

import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { MobileTabBar } from './MobileTabBar';
import type { Locale } from '@/lib/i18n-public';

export function PublicShell({
  locale,
  copy,
  children,
}: {
  locale: Locale;
  copy: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader locale={locale} copy={copy} />
      <main className="site-main">{children}</main>
      <PublicFooter locale={locale} copy={copy} />
      <MobileTabBar locale={locale} copy={copy} />
    </>
  );
}
