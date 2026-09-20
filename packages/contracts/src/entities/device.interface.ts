import { DeviceStatus } from '../enums/device-status.enum.js';

export interface Device {
  id: string;
  organizationId: string;
  branchId: string;
  agentInstanceId: string;
  hostname: string;
  os: string;
  appVersion: string;
  status: DeviceStatus;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  /** Backward compatibility alias for organizationId */
  tenantId?: string;
}
