/**
 * AI may only read public catalog/pricing/inventory/facility contracts.
 * Never write or invent price, stock, seller identity, or professional availability.
 */
export const AI_CATALOG_ACCESS_POLICY = {
  mode: 'read_only' as const,
  mayRead: [
    'publicListing',
    'publicPrice',
    'publicInventory',
    'publicFacilityLocation',
  ] as const,
  mayWrite: [] as const,
  forbiddenToInvent: [
    'displayPrice',
    'available',
    'supplierCost',
    'onHand',
    'reserved',
    'sellerIdentity',
    'professionalAvailability',
  ] as const,
};

export function assertAiDoesNotInventCatalogFacts(payload: Record<string, unknown>): void {
  for (const key of AI_CATALOG_ACCESS_POLICY.forbiddenToInvent) {
    if (key in payload && payload[key] !== undefined) {
      // Gateways/services must never attach invented commercial facts from LLM output.
      throw new Error(`AI_INVENTED_FORBIDDEN_FIELD:${key}`);
    }
  }
}
