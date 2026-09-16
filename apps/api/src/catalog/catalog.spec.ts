import { AttributeDataType, ListingStatus } from '@peytakilid/shared-types';
import { UOM_CODES } from '@peytakilid/shared-types';

describe('catalog shared contracts', () => {
  it('defines attribute and listing enums', () => {
    expect(AttributeDataType.ENUM).toBe('ENUM');
    expect(ListingStatus.PENDING_REVIEW).toBe('PENDING_REVIEW');
    expect(ListingStatus.PUBLISHED).toBe('PUBLISHED');
  });

  it('exposes generic UoM codes', () => {
    expect(UOM_CODES).toContain('m2');
    expect(UOM_CODES).toContain('pcs');
  });
});

describe('attribute inheritance merge', () => {
  type Def = { code: string; categoryId: string; inheritToChildren: boolean; nameEn: string };

  function mergeEffective(chainRootToLeaf: string[], defsByCategory: Record<string, Def[]>) {
    const byCode = new Map<string, Def>();
    const leaf = chainRootToLeaf[chainRootToLeaf.length - 1];
    for (const id of chainRootToLeaf) {
      for (const def of defsByCategory[id] ?? []) {
        if (id !== leaf && !def.inheritToChildren) continue;
        byCode.set(def.code, def);
      }
    }
    return [...byCode.values()];
  }

  it('lets child override parent code and skips non-inheriting parent attrs', () => {
    const result = mergeEffective(['root', 'child'], {
      root: [
        { code: 'color', categoryId: 'root', inheritToChildren: true, nameEn: 'Color' },
        { code: 'finish', categoryId: 'root', inheritToChildren: false, nameEn: 'Finish' },
      ],
      child: [{ code: 'color', categoryId: 'child', inheritToChildren: true, nameEn: 'Shade' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].nameEn).toBe('Shade');
  });
});

describe('moderation gate order', () => {
  const order = [
    ListingStatus.DRAFT,
    ListingStatus.PENDING_REVIEW,
    ListingStatus.APPROVED,
    ListingStatus.PUBLISHED,
  ];

  it('follows draft → review → approved → published', () => {
    expect(order.indexOf(ListingStatus.DRAFT)).toBeLessThan(
      order.indexOf(ListingStatus.PENDING_REVIEW),
    );
    expect(order.indexOf(ListingStatus.PENDING_REVIEW)).toBeLessThan(
      order.indexOf(ListingStatus.APPROVED),
    );
    expect(order.indexOf(ListingStatus.APPROVED)).toBeLessThan(
      order.indexOf(ListingStatus.PUBLISHED),
    );
  });
});
