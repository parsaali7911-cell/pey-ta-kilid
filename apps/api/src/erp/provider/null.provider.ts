import {
  ERP_NOT_CONFIGURED,
  ErpCustomerInput,
  ErpItemInput,
  ErpPaymentEntryInput,
  ErpProvider,
  ErpSalesOrderInput,
  ErpSupplierInput,
  ErpSyncResult,
} from './erp-provider.interface';

/** Default provider — ERP unavailable; outbox stays retryable. */
export class NullErpProvider implements ErpProvider {
  readonly name = 'none';
  readonly configured = false;

  async healthCheck() {
    return { ok: false, error: ERP_NOT_CONFIGURED };
  }

  private unavailable(): never {
    throw new Error(ERP_NOT_CONFIGURED);
  }

  upsertCustomer(_input: ErpCustomerInput): Promise<ErpSyncResult> {
    return this.unavailable();
  }
  upsertSupplier(_input: ErpSupplierInput): Promise<ErpSyncResult> {
    return this.unavailable();
  }
  upsertItem(_input: ErpItemInput): Promise<ErpSyncResult> {
    return this.unavailable();
  }
  createSalesOrder(_input: ErpSalesOrderInput): Promise<ErpSyncResult> {
    return this.unavailable();
  }
  createPaymentEntry(_input: ErpPaymentEntryInput): Promise<ErpSyncResult> {
    return this.unavailable();
  }
}
