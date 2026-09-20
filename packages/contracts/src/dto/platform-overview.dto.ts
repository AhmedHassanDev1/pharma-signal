export interface PlatformHealthDto {
  status: 'ok' | 'degraded' | 'down';
  database: 'up' | 'down';
  api: 'up' | 'down';
  uptime: number;
  version: string;
  timestamp: string;
}

export interface PlatformMetricsDto {
  activeDevices: number;
  totalDevices: number;
  totalDataSources: number;
  totalSyncBatches: number;
  totalCanonicalRecords: number;
  totalOrganizations: number;
  totalBranches: number;
}

export interface RecentSyncBatchItemDto {
  id: string;
  syncBatchId: string;
  dataSourceId: string;
  status: string;
  receivedTotal: number;
  appliedTotal: number;
  rejectedTotal: number;
  processedAt: string | null;
  createdAt: string;
}

export interface RecentDeviceItemDto {
  id: string;
  hostname: string;
  os: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface PlatformOverviewDto {
  health: PlatformHealthDto;
  metrics: PlatformMetricsDto;
  recentBatches: RecentSyncBatchItemDto[];
  recentDevices: RecentDeviceItemDto[];
}
