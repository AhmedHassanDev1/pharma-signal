import { SyncBatchStatus } from '../enums/sync-batch-status.enum.js';

export interface SyncBatchCounts {
  products: number;
  batches: number;
  inventories: number;
  suppliers: number;
  totalRecords: number;
}

export interface SyncBatch {
  id: string;
  syncBatchId: string;
  dataSourceId: string;
  deviceId: string;
  tenantId: string;
  status: SyncBatchStatus;
  counts: SyncBatchCounts;
  errorMessage?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncBatchSummary {
  syncBatchId: string;
  status: SyncBatchStatus;
  receivedCounts: SyncBatchCounts;
  appliedCounts: SyncBatchCounts;
  rejectedCounts: number;
  message?: string;
}
