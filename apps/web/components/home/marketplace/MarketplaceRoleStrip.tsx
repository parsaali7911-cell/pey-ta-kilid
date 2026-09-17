import type { Locale } from '@/lib/i18n-public';

/** Slim role shortcuts under categories — replaces heavy entry cards. */
export function MarketplaceRoleStrip({
  locale,
  copy,
}: {
  locale: Locale;
  copy: Record<string, string>;
}) {
  const items = [
    { href: `/${locale}/search`, label: copy.mp_role_buy },
    { href: `/${locale}/register?intent=seller`, label: copy.mp_role_sell },
    { href: `/${locale}/professionals?onboard=1`, label: copy.mp_role_pro },
  ];

  return (
    <section className="mb-roles" aria-label={copy.mp_roles_label}>
      <div className="mb-roles__inner">
        {items.map((item) => (
          <a key={item.href} className="mb-role" href={item.href}>
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}
