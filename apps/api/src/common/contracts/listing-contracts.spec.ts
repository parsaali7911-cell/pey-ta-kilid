import {
  assertNoPrivateLeak,
  toPublicInventory,
  toPublicListing,
  toPublicPrice,
  toSellerInventory,
  toSellerPrice,
} from './listing-contracts';

describe('public vs seller contracts', () => {
  const price = {
    displayPrice: 112,
    currency: 'USD',
    priceType: 'EXW',
    supplierCost: 100,
    fxRateApplied: 1,
    marginPercentApplied: 10,
    flatFeeApplied: 2,
  };

  const inventory = { onHand: 50, reserved: 20, uomCode: 'kg' };

  it('public price omits supplierCost and rule internals', () => {
    const pub = toPublicPrice(price);
    expect(pub).toEqual({ displayPrice: 112, currency: 'USD', priceType: 'EXW' });
    assertNoPrivateLeak(pub);
  });

  it('seller price includes supplierCost only', () => {
    const seller = toSellerPrice(price);
    expect(seller?.supplierCost).toBe(100);
    expect(seller).not.toHaveProperty('fxRateApplied');
  });

  it('public inventory exposes available only', () => {
    const pub = toPublicInventory(inventory);
    expect(pub).toEqual({ available: 30, uomCode: 'kg' });
    assertNoPrivateLeak(pub);
  });

  it('seller inventory exposes onHand/reserved/available', () => {
    expect(toSellerInventory(inventory)).toEqual({
      onHand: 50,
      reserved: 20,
      available: 30,
      uomCode: 'kg',
    });
  });

  it('public listing serialization rejects private key leaks', () => {
    const listing = toPublicListing({
      id: '1',
      slug: 'x',
      title: 'Tile',
      price,
      inventory,
    });
    expect(listing.price).not.toHaveProperty('supplierCost');
    expect(listing.inventory).not.toHaveProperty('onHand');
    expect(() =>
      assertNoPrivateLeak({
        price: { supplierCost: 1, displayPrice: 2, currency: 'USD', priceType: 'EXW' },
      }),
    ).toThrow(/supplierCost/);
  });
});
