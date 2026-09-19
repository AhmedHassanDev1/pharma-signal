import { RecordProvenance } from '../entities/canonical/provenance.interface.js';
import { SyncBatchStatus } from '../enums/sync-batch-status.enum.js';
import { SyncBatchCounts } from '../entities/sync-batch.interface.js';

export interface SyncRecordPayload<T = Record<string, unknown>> {
  sourceId: string;
  sourceTable: string;
  data: T;
  provenance: RecordProvenance;
}

export interface CanonicalSyncRequestDto {
  dataSourceId: string;
  syncBatchId: string;
  products?: SyncRecordPayload[];
  batches?: SyncRecordPayload[];
  inventories?: SyncRecordPayload[];
  suppliers?: SyncRecordPayload[];
}

export interface CanonicalSyncResponseDto {
  syncBatchId: string;
  status: SyncBatchStatus;
  receivedCounts: SyncBatchCounts;
  appliedCounts: SyncBatchCounts;
  rejectedCounts: number;
  message?: string;
}
