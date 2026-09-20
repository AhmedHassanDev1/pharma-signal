import { DetectionStatus } from '../enums/detection-status.enum.js';

export interface RegisterDataSourceRequestDto {
  localDataSourceKey: string;
  engine: string;
  databaseName: string;
  branchId?: string;
  branch_id?: string;
  organizationId?: string;
  organization_id?: string;
  deviceId?: string;
  device_id?: string;
  declaredSoftwareName?: string | null;
  detectedSoftwareName?: string | null;
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
