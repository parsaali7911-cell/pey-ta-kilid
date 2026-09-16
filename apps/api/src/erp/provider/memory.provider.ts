import {
  ErpCustomerInput,
  ErpItemInput,
  ErpPaymentEntryInput,
  ErpProvider,
  ErpSalesOrderInput,
  ErpSupplierInput,
  ErpSyncResult,
} from './erp-provider.interface';

/**
 * In-process idempotent ERP adapter for local/test.
 * Keyed by Peytakilid entity IDs — retries never duplicate documents.
 */
export class InMemoryErpProvider implements ErpProvider {
  readonly name = 'memory';
  readonly configured = true;

  private customers = new Map<string, string>();
  private suppliers = new Map<string, string>();
  private items = new Map<string, string>();
  private orders = new Map<string, string>();
  private payments = new Map<string, string>();
  private failNext = false;

  /** Test helper — force next call to fail once. */
  setFailNext(value: boolean) {
    this.failNext = value;
  }

  clear() {
    this.customers.clear();
    this.suppliers.clear();
    this.items.clear();
    this.orders.clear();
    this.payments.clear();
    this.failNext = false;
  }

  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }

  private maybeFail() {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Simulated ERP failure');
    }
  }

  async upsertCustomer(input: ErpCustomerInput): Promise<ErpSyncResult> {
    this.maybeFail();
    const existing = this.customers.get(input.peytakilidId);
    if (existing) return { externalId: existing };
    const externalId = `CUST-${input.peytakilidId.slice(0, 8)}`;
    this.customers.set(input.peytakilidId, externalId);
    return { externalId };
  }

  async upsertSupplier(input: ErpSupplierInput): Promise<ErpSyncResult> {
    this.maybeFail();
    const existing = this.suppliers.get(input.peytakilidId);
    if (existing) return { externalId: existing };
    const externalId = `SUP-${input.peytakilidId.slice(0, 8)}`;
    this.suppliers.set(input.peytakilidId, externalId);
    return { externalId };
  }

  async upsertItem(input: ErpItemInput): Promise<ErpSyncResult> {
    this.maybeFail();
    const existing = this.items.get(input.peytakilidId);
    if (existing) return { externalId: existing };
    const externalId = input.itemCode;
    this.items.set(input.peytakilidId, externalId);
    return { externalId };
  }

  async createSalesOrder(input: ErpSalesOrderInput): Promise<ErpSyncResult> {
    this.maybeFail();
    const existing = this.orders.get(input.peytakilidOrderId);
    if (existing) return { externalId: existing };
    const externalId = `SO-${input.peytakilidOrderId.slice(0, 8)}`;
    this.orders.set(input.peytakilidOrderId, externalId);
    return { externalId };
  }

  async createPaymentEntry(input: ErpPaymentEntryInput): Promise<ErpSyncResult> {
    this.maybeFail();
    const existing = this.payments.get(input.peytakilidPaymentId);
    if (existing) return { externalId: existing };
    const externalId = `PE-${input.peytakilidPaymentId.slice(0, 8)}`;
    this.payments.set(input.peytakilidPaymentId, externalId);
    return { externalId };
  }
}
