import {
  RequestIntent,
  StructuredRequirements,
} from '@peytakilid/shared-types';
import { assertNoPrivateLeak } from '../common/contracts/listing-contracts';
import {
  mergeFiltersFromRequirements,
  normalizeSearchQuery,
  requirementsToSearchQuery,
} from './search-query.adapter';
import { flattenAttributes, toSearchHit } from './search.mapper';
import { RankableListing, rankListing } from './search.ranking';

function baseRequirements(
  overrides: Partial<StructuredRequirements> = {},
): StructuredRequirements {
  return {
    intent: RequestIntent.PRODUCT,
    market: 'IRAN',
    locale: 'en',
    quantity: 100,
    uomCode: 'm2',
    categoryHints: ['tile'],
    attributeFilters: {},
    budget: { min: 10, max: 100, currency: 'USD' },
    location: null,
    facilityProximity: null,
    listingIdHints: [],
    specialtyHints: [],
    confidence: 0.9,
    missingFields: [],
    rawText: 'buy tile',
    ...overrides,
  };
}

function baseListing(overrides: Partial<RankableListing> = {}): RankableListing {
  return {
    id: 'lst_1',
    title: 'Beige Ceramic Tile',
    description: 'Floor tile',
    slug: 'beige-ceramic-tile',
    uomCode: 'm2',
    moq: 20,
    leadTimeDays: 7,
    category: {
      id: 'cat_tile',
      slug: 'tile',
      nameEn: 'Tile',
      nameFa: 'کاشی',
      nameAr: 'بلاط',
    },
    attributes: [{ code: 'color', valueString: 'beige', valueNumber: null, valueBoolean: null }],
    displayPrice: 45,
    currency: 'USD',
    available: 200,
    facilityPublic: {
      id: 'fac_1',
      city: 'Tehran',
      province: 'Tehran',
      countryCode: 'IR',
    },
    ...overrides,
  };
}

describe('search query adapter', () => {
  it('converts StructuredRequirements → SearchQuery', () => {
    const req = baseRequirements({
      attributeFilters: { color: 'beige' },
      listingIdHints: ['lst_1'],
      location: { city: 'Tehran', countryCode: 'IR' },
      rawText: 'beige tile',
    });
    const q = requirementsToSearchQuery(req, { limit: 10 });
    expect(q.requirements).toBe(req);
    expect(q.limit).toBe(10);
    expect(q.filters?.categoryHints).toEqual(['tile']);
    expect(q.filters?.attributeFilters).toEqual({ color: 'beige' });
    expect(q.filters?.priceMax).toBe(100);
    expect(q.filters?.currency).toBe('USD');
    expect(q.filters?.requireMoqFit).toBe(true);
    expect(q.filters?.listingIds).toEqual(['lst_1']);
    // Buyer city soft-boosts text; not a hard facility filter.
    expect(q.filters?.location).toBeNull();
    expect(q.filters?.text).toContain('Tehran');
  });

  it('keeps soft attrs out of hard attribute filters', () => {
    const filters = mergeFiltersFromRequirements(baseRequirements(), {
      visionAttributeHints: { finish: 'polished' },
      attributeFilters: { color: 'white' },
    });
    expect(filters.attributeFilters).toEqual({
      color: 'white',
    });
    expect(filters.text).toContain('polished');
  });

  it('normalizes limit/offset bounds', () => {
    const q = normalizeSearchQuery({
      requirements: baseRequirements(),
      limit: 999,
      offset: -5,
    });
    expect(q.limit).toBe(100);
    expect(q.offset).toBe(0);
  });
});

describe('deterministic ranking', () => {
  it('matches text and category', () => {
    const r = rankListing(baseListing(), {
      text: 'beige tile',
      categoryHints: ['tile'],
      requireAvailable: true,
    });
    expect(r.excluded).toBe(false);
    expect(r.scoreComponents.some((c) => c.key === 'text')).toBe(true);
    expect(r.scoreComponents.some((c) => c.key === 'category')).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('filters attributes strictly', () => {
    const miss = rankListing(baseListing(), {
      attributeFilters: { color: 'black' },
      requireAvailable: false,
    });
    expect(miss.excluded).toBe(true);

    const hit = rankListing(baseListing(), {
      attributeFilters: { color: 'beige' },
      requireAvailable: false,
    });
    expect(hit.excluded).toBe(false);
    expect(hit.matchedAttributes).toContain('color');
  });

  it('applies price and currency boundaries', () => {
    expect(
      rankListing(baseListing({ displayPrice: 200 }), {
        priceMax: 100,
        currency: 'USD',
        requireAvailable: false,
      }).excluded,
    ).toBe(true);

    expect(
      rankListing(baseListing({ currency: 'EUR' }), {
        currency: 'USD',
        requireAvailable: false,
      }).excluded,
    ).toBe(true);

    const ok = rankListing(baseListing(), {
      priceMin: 10,
      priceMax: 100,
      currency: 'USD',
      requireAvailable: false,
    });
    expect(ok.excluded).toBe(false);
    expect(ok.scoreComponents.some((c) => c.key === 'price')).toBe(true);
  });

  it('enforces inventory availability and MOQ fit', () => {
    expect(
      rankListing(baseListing({ available: 0 }), {
        requireAvailable: true,
      }).excluded,
    ).toBe(true);

    expect(
      rankListing(baseListing({ moq: 500 }), {
        quantity: 100,
        requireMoqFit: true,
        requireAvailable: false,
      }).excluded,
    ).toBe(true);

    const fit = rankListing(baseListing({ moq: 20, available: 150 }), {
      quantity: 100,
      requireMoqFit: true,
      requireAvailable: true,
      requireQuantityAvailable: true,
    });
    expect(fit.excluded).toBe(false);
    expect(fit.scoreComponents.some((c) => c.key === 'moq')).toBe(true);
    expect(fit.scoreComponents.some((c) => c.key === 'availability')).toBe(true);
  });

  it('scores location only from public facility; drops private-less matches when city required', () => {
    const withLoc = rankListing(baseListing(), {
      location: { city: 'Tehran', countryCode: 'IR' },
      requireAvailable: false,
    });
    expect(withLoc.excluded).toBe(false);
    expect(withLoc.scoreComponents.some((c) => c.key === 'location')).toBe(true);

    const noFac = rankListing(baseListing({ facilityPublic: null }), {
      location: { city: 'Tehran' },
      requireAvailable: false,
    });
    expect(noFac.excluded).toBe(true);
  });

  it('is deterministic across multiple listings for same product cues', () => {
    const filters = {
      text: 'tile',
      categoryHints: ['tile'],
      requireAvailable: false,
    };
    const a = rankListing(baseListing({ id: 'a', title: 'Tile A', displayPrice: 40 }), filters);
    const b = rankListing(baseListing({ id: 'b', title: 'Tile B', displayPrice: 40 }), filters);
    expect(a.excluded).toBe(false);
    expect(b.excluded).toBe(false);
    // same components → same score when inputs equivalent aside from id/title token density
    const a2 = rankListing(baseListing({ id: 'a', title: 'Tile', displayPrice: 40 }), filters);
    const b2 = rankListing(baseListing({ id: 'b', title: 'Tile', displayPrice: 40 }), filters);
    expect(a2.score).toBe(b2.score);
  });

  it('returns empty/no-match via exclusion', () => {
    const r = rankListing(baseListing(), {
      categoryHints: ['cement'],
      text: 'zzzz-nomatch',
      attributeFilters: { color: 'neon' },
      requireAvailable: false,
    });
    expect(r.excluded).toBe(true);
    expect(r.score).toBe(0);
  });
});

describe('search hit public mapper', () => {
  it('does not leak supplierCost / private inventory / private location', () => {
    const hit = toSearchHit({
      listing: {
        id: 'lst_1',
        slug: 'beige-tile',
        title: 'Beige Tile',
        description: null,
        uomCode: 'm2',
        moq: 10,
        leadTimeDays: 5,
        category: {
          id: 'c1',
          slug: 'tile',
          nameEn: 'Tile',
          nameFa: 'کاشی',
          nameAr: 'بلاط',
        },
        organization: { id: 'org1', name: 'Seller Co', slug: 'seller-co' },
        attributes: [
          {
            attributeDefinition: { code: 'color' },
            valueString: 'beige',
            valueNumber: null,
            valueBoolean: null,
          },
        ],
        price: {
          displayPrice: 45,
          currency: 'USD',
          priceType: 'EXW',
          supplierCost: 30,
        },
        inventory: { onHand: 100, reserved: 10, uomCode: 'm2' },
        facility: {
          id: 'f1',
          type: 'WAREHOUSE',
          isPublicLocation: true,
          address: {
            countryCode: 'IR',
            region: null,
            province: 'Tehran',
            city: 'Tehran',
            line1: 'SECRET STREET 1',
            line2: null,
            postalCode: '12345',
          },
        },
      },
      localizedTitle: 'کاشی بژ',
      localeCategoryName: 'کاشی',
      score: 42,
      matchedAttributes: ['color'],
      scoreComponents: [{ key: 'attribute', points: 20, reason: 'attributes: color' }],
    });

    expect(hit.preview.displayPrice).toBe(45);
    expect(hit.preview.available).toBe(90);
    expect(hit.preview.organizationPublic?.name).toBe('Seller Co');
    expect(hit.preview.facilityPublic?.city).toBe('Tehran');
    expect(hit.preview.facilityPublic).not.toHaveProperty('line1');
    expect(JSON.stringify(hit)).not.toMatch(/supplierCost|"onHand"|"reserved"|"line1"/);
    expect(() => assertNoPrivateLeak(hit)).not.toThrow();
    expect(flattenAttributes({
      id: 'x',
      slug: 'x',
      title: 'x',
      description: null,
      uomCode: 'm2',
      moq: null,
      leadTimeDays: null,
      category: { id: 'c', slug: 'c', nameEn: 'C', nameFa: null, nameAr: null },
      organization: { id: 'o', name: 'O', slug: 'o' },
      attributes: [
        {
          attributeDefinition: { code: 'color' },
          valueString: 'beige',
          valueNumber: null,
          valueBoolean: null,
        },
      ],
      price: null,
      inventory: null,
      facility: null,
    })[0].code).toBe('color');
  });

  it('omits facility when not public', () => {
    const hit = toSearchHit({
      listing: {
        id: 'lst_2',
        slug: 'x',
        title: 'X',
        description: null,
        uomCode: 'pcs',
        moq: null,
        leadTimeDays: null,
        category: { id: 'c', slug: 'c', nameEn: 'C', nameFa: null, nameAr: null },
        organization: { id: 'o', name: 'O', slug: 'o' },
        attributes: [],
        price: null,
        inventory: null,
        facility: {
          id: 'f2',
          type: 'FACTORY',
          isPublicLocation: false,
          address: {
            countryCode: 'IR',
            region: null,
            province: null,
            city: 'Hidden',
            line1: 'private',
          },
        },
      },
      localizedTitle: 'X',
      localeCategoryName: 'C',
      score: 1,
      matchedAttributes: [],
      scoreComponents: [],
    });
    expect(hit.preview.facilityPublic).toBeNull();
  });

  it('supports localized category names fa/en/ar via mapper input', () => {
    const fa = toSearchHit({
      listing: {
        id: '1',
        slug: 's',
        title: 'T',
        description: null,
        uomCode: 'm2',
        moq: null,
        leadTimeDays: null,
        category: {
          id: 'c',
          slug: 'tile',
          nameEn: 'Tile',
          nameFa: 'کاشی',
          nameAr: 'بلاط',
        },
        organization: { id: 'o', name: 'O', slug: 'o' },
        attributes: [],
        price: { displayPrice: 1, currency: 'IRR', priceType: 'EXW' },
        inventory: { onHand: 5, reserved: 0, uomCode: 'm2' },
        facility: null,
      },
      localizedTitle: 'عنوان',
      localeCategoryName: 'کاشی',
      score: 1,
      matchedAttributes: [],
      scoreComponents: [],
    });
    expect(fa.preview.category?.name).toBe('کاشی');
    expect(fa.preview.title).toBe('عنوان');
  });
});
