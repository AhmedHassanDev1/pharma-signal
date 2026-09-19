export interface RecordProvenance {
  tenantId: string;
  deviceId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  extractedAt: string;
  hash?: string;
}
