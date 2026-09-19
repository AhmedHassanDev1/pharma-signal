import { RecordProvenance } from './provenance.interface.js';

export interface CanonicalSupplier {
  id: string;
  tenantId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
  rawPayload?: Record<string, unknown> | null;
  provenance: RecordProvenance;
  createdAt: string;
  updatedAt: string;
}
