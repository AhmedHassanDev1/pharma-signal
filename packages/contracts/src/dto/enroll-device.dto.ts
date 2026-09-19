import { DeviceStatus } from '../enums/device-status.enum.js';

export interface EnrollDeviceRequestDto {
  enrollmentToken: string;
  agentInstanceId: string;
  hostname: string;
  os: string;
  appVersion: string;
}

export interface EnrollDeviceResponseDto {
  deviceId: string;
  tenantId: string;
  deviceToken: string;
  status: DeviceStatus;
}
