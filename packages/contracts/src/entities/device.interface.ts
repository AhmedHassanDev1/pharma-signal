import { DeviceStatus } from '../enums/device-status.enum.js';

export interface Device {
  id: string;
  tenantId: string;
  agentInstanceId: string;
  hostname: string;
  os: string;
  appVersion: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}
