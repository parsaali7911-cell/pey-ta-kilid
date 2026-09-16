import { BrandLogo } from '@/components/BrandLogo';
import type { Locale } from '@/lib/i18n-public';

type Copy = Record<string, string>;

export function PublicFooter({ locale, copy }: { locale: Locale; copy: Copy }) {
  const nav = [
    { href: `/${locale}/catalog`, label: copy.nav_catalog },
    { href: `/${locale}/search`, label: copy.nav_search },
    { href: `/${locale}/search?intent=professional`, label: copy.nav_professionals },
    { href: `/${locale}/search?intent=design`, label: copy.nav_design },
    { href: `/${locale}/search?from=sellers`, label: copy.nav_sellers },
  ];

  return (
    <footer className="site-footer public-footer home-footer">
      <div className="home-footer__inner">
        <div className="home-footer__brand">
          <BrandLogo href={`/${locale}`} className="footer-brand-wrap" size={48} label={copy.brand} />
          <p className="home-footer__tagline">{copy.footer_tagline}</p>
        </div>

        <nav className="home-footer__nav" aria-label="Footer">
          {nav.map((item) => (
            <a key={item.href + item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="home-footer__langs">
          <a href="/fa">FA</a>
          <a href="/en">EN</a>
          <a href="/ar">AR</a>
        </div>
      </div>
      <p className="footer-legal">{copy.footer}</p>
    </footer>
  );
}
