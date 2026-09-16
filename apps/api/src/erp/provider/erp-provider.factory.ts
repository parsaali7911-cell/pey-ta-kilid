import { InMemoryErpProvider } from './memory.provider';
import { NullErpProvider } from './null.provider';
import { ErpProvider } from './erp-provider.interface';

export function createErpProvider(env: NodeJS.ProcessEnv = process.env): ErpProvider {
  const kind = (env.ERP_PROVIDER || 'none').toLowerCase().trim();
  if (kind === 'memory') return new InMemoryErpProvider();
  // erpnext reserved for later full client; stay ERP-independent until configured.
  return new NullErpProvider();
}
