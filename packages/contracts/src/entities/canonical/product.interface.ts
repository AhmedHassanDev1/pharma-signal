import { RecordProvenance } from './provenance.interface.js';

export interface CanonicalProduct {
  id: string;
  tenantId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  isActive: boolean;
  rawPayload?: Record<string, unknown> | null;
  provenance: RecordProvenance;
  createdAt: string;
  updatedAt: string;
}
