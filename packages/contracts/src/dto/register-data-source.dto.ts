import { DetectionStatus } from '../enums/detection-status.enum.js';

export interface RegisterDataSourceRequestDto {
  localDataSourceKey: string;
  engine: string;
  databaseName: string;
  branchId?: string;
  declaredSoftwareName?: string;
  detectedSoftwareName?: string;
}

export interface RegisterDataSourceResponseDto {
  dataSourceId: string;
  organizationId: string;
  branchId: string;
  deviceId: string;
  localDataSourceKey: string;
  declaredSoftwareName?: string | null;
  detectedSoftwareName?: string | null;
  detectionStatus: DetectionStatus;
  status: string;
  /** Backward compatibility alias for organizationId */
  tenantId?: string;
}
