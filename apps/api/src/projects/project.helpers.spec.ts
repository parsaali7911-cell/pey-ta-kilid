import { computeRecommendedRfqDate, PROJECT_STAGE_CATALOG } from '@peytakilid/shared-types';

describe('project shared helpers', () => {
  it('has construction stage catalog', () => {
    expect(PROJECT_STAGE_CATALOG.length).toBeGreaterThanOrEqual(10);
    expect(PROJECT_STAGE_CATALOG.some((s) => s.code === 'mep')).toBe(true);
  });

  it('recommended RFQ date requires verified lead time', () => {
    expect(computeRecommendedRfqDate('2026-10-20', null)).toBeNull();
    const d = computeRecommendedRfqDate('2026-10-20T00:00:00.000Z', 15);
    expect(d?.toISOString().slice(0, 10)).toBe('2026-10-05');
  });
});
