import { DeviceStatus } from '../enums/device-status.enum.js';

export interface EnrollDeviceRequestDto {
  enrollmentToken: string;
  agentInstanceId: string;
  hostname: string;
  os: string;
  appVersion: string;
  branchId?: string;
}

export interface EnrollDeviceResponseDto {
  deviceId: string;
  organizationId: string;
  branchId: string;
  deviceToken: string;
  status: DeviceStatus;
  /** Backward compatibility alias for organizationId */
  tenantId?: string;
}
