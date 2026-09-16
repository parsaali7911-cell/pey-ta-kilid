import {
  availableQuantity,
  calculateBuyerDisplayPrice,
  RoundingMode,
} from '@peytakilid/shared-types';

describe('pricing engine', () => {
  it('applies margin, fee, fx and rounding generically', () => {
    const result = calculateBuyerDisplayPrice(100, {
      marginPercent: 10,
      flatFee: 5,
      fxRate: 2,
      roundingMode: RoundingMode.ROUND_NEAREST,
      roundingUnit: 1,
    });
    // 100*2=200, +10%=220, +5=225
    expect(result.displayPrice).toBe(225);
    expect(result.fxRateApplied).toBe(2);
  });

  it('supports ROUND_UP without IRR-specific rules', () => {
    const result = calculateBuyerDisplayPrice(10, {
      marginPercent: 0,
      flatFee: 0,
      fxRate: 1,
      roundingMode: RoundingMode.ROUND_UP,
      roundingUnit: 5,
    });
    expect(result.displayPrice).toBe(10);
  });
});

describe('inventory availability', () => {
  it('computes available = onHand - reserved', () => {
    expect(availableQuantity(100, 40)).toBe(60);
    expect(availableQuantity(10, 15)).toBe(0);
  });
});
