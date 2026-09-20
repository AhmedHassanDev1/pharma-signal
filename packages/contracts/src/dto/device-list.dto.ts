export interface DeviceListItemDto {
  id: string;
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchName: string;
  agentInstanceId: string;
  hostname: string;
  os: string;
  appVersion: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
  dataSourcesCount: number;
}
