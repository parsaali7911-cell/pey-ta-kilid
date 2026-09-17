import {
  computeRecommendedRfqDate,
  PROJECT_STAGE_CATALOG,
  buildStageSuggestions,
} from '@peytakilid/shared-types';

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

  it('stage suggestions prioritize current stage and advance-buy', () => {
    const needs = buildStageSuggestions({
      currentStageCode: 'walls',
      projectTypeCode: 'villa',
      areaM2: 200,
      includeUpcoming: 2,
    });
    expect(needs.length).toBeGreaterThan(5);
    const now = needs.filter((n) => n.priority === 'now');
    expect(now.length).toBeGreaterThan(0);
    expect(now.every((n) => n.stageCode === 'walls')).toBe(true);
    expect(needs[0].priority).toBe('now');
    expect(
      now.some((n) => n.specialtyCode === 'landscape' || n.categorySlug === 'natural-stone'),
    ).toBe(true);
    const soon = needs.filter((n) => n.priority === 'soon');
    expect(soon.length).toBeGreaterThan(0);
  });
});
