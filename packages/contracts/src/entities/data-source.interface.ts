import { DetectionStatus } from '../enums/detection-status.enum.js';

export interface DataSource {
  id: string;
  organizationId: string;
  branchId: string;
  deviceId: string;
  localDataSourceKey: string;
  engine: string;
  databaseName: string;
  declaredSoftwareName?: string | null;
  detectedSoftwareName?: string | null;
  detectionStatus: DetectionStatus;
  status: string;
  createdAt: string;
  updatedAt?: string;
  /** Backward compatibility alias for organizationId */
  tenantId?: string;
}
