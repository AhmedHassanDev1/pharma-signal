import { RecordProvenance } from './provenance.interface.js';

export interface CanonicalInventory {
  id: string;
  tenantId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  productSourceId: string;
  productId?: string | null;
  batchSourceId?: string | null;
  batchId?: string | null;
  quantity: number;
  unitPrice?: number | null;
  location?: string | null;
  rawPayload?: Record<string, unknown> | null;
  provenance: RecordProvenance;
  createdAt: string;
  updatedAt: string;
}
