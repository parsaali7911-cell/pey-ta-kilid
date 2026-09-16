export const ERP_NOT_CONFIGURED = 'ERP_NOT_CONFIGURED';
export const ERP_PROVIDER = Symbol('ERP_PROVIDER');

export type ErpSyncResult = {
  externalId: string;
  raw?: unknown;
};

export type ErpCustomerInput = {
  peytakilidId: string;
  customerName: string;
  currency: string;
  email?: string;
  country?: string;
};

export type ErpSupplierInput = {
  peytakilidId: string;
  supplierName: string;
  currency: string;
  country?: string;
};

export type ErpItemInput = {
  peytakilidId: string;
  itemName: string;
  itemCode: string;
  stockUom: string;
};

export type ErpSalesOrderInput = {
  peytakilidOrderId: string;
  customerExternalId: string;
  currency: string;
  /** Buyer display rates only — never seller base cost */
  items: Array<{ itemCode: string; qty: number; rate: number }>;
  deliveryDate?: string;
};

export type ErpPaymentEntryInput = {
  peytakilidPaymentId: string;
  partyType: 'Customer' | 'Supplier';
  partyExternalId: string;
  amount: number;
  currency: string;
  referenceNo?: string;
  againstOrderExternalId?: string;
};

export interface ErpProvider {
  readonly name: string;
  readonly configured: boolean;

  healthCheck(): Promise<{ ok: boolean; latencyMs?: number; error?: string }>;

  upsertCustomer(input: ErpCustomerInput): Promise<ErpSyncResult>;
  upsertSupplier(input: ErpSupplierInput): Promise<ErpSyncResult>;
  upsertItem(input: ErpItemInput): Promise<ErpSyncResult>;

  createSalesOrder(input: ErpSalesOrderInput): Promise<ErpSyncResult>;
  createPaymentEntry(input: ErpPaymentEntryInput): Promise<ErpSyncResult>;
}
