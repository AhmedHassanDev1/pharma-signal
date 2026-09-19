import { RecordProvenance } from './provenance.interface.js';

export interface CanonicalBatch {
  id: string;
  tenantId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  productSourceId: string;
  productId?: string | null;
  batchNumber: string;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  rawPayload?: Record<string, unknown> | null;
  provenance: RecordProvenance;
  createdAt: string;
  updatedAt: string;
}
