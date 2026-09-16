import type { Locale } from '@/lib/i18n-public';

type EntryId = 'catalog' | 'need' | 'professionals' | 'sellers';

const VARIANT_MAP: Record<EntryId, string> = {
  catalog: 'stoneProducts',
  need: 'stoneBuyer',
  professionals: 'blockProducts',
  sellers: 'factoryOwner',
};

export function MarketplaceEntryPaths({
  locale,
  copy,
}: {
  locale: Locale;
  copy: Record<string, string>;
}) {
  const cards: Array<{
    id: EntryId;
    href: string;
    numKey: string;
    titleKey: string;
    textKey: string;
  }> = [
    {
      id: 'catalog',
      href: `/${locale}/catalog`,
      numKey: 'mp_entry_catalog_num',
      titleKey: 'mp_entry_catalog_title',
      textKey: 'mp_entry_catalog_text',
    },
    {
      id: 'need',
      href: `/${locale}/search`,
      numKey: 'mp_entry_need_num',
      titleKey: 'mp_entry_need_title',
      textKey: 'mp_entry_need_text',
    },
    {
      id: 'professionals',
      href: `/${locale}/professionals`,
      numKey: 'mp_entry_pro_num',
      titleKey: 'mp_entry_pro_title',
      textKey: 'mp_entry_pro_text',
    },
    {
      id: 'sellers',
      href: `/${locale}/register?intent=seller`,
      numKey: 'mp_entry_seller_num',
      titleKey: 'mp_entry_seller_title',
      textKey: 'mp_entry_seller_text',
    },
  ];

  return (
    <section className="mp-entry" aria-label={copy.mp_entry_label}>
      <div className="mp-entry__grid">
        {cards.map((card) => (
          <a
            key={card.id}
            className={`mp-entry-card mp-entry-card--${VARIANT_MAP[card.id]}`}
            href={card.href}
          >
            <span className="mp-entry-card__media" aria-hidden>
              <span className={`mp-entry-backdrop mp-entry-backdrop--${VARIANT_MAP[card.id]}`} />
            </span>
            <span className="mp-entry-card__overlay" aria-hidden />
            <span className="mp-entry-card__body">
              <span className="mp-entry-card__num">{copy[card.numKey]}</span>
              <span className="mp-entry-card__title">{copy[card.titleKey]}</span>
              <span className="mp-entry-card__text">{copy[card.textKey]}</span>
              <span className="mp-entry-card__arrow" aria-hidden>
                →
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
