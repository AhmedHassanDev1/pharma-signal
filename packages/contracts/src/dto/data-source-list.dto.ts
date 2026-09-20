import { TableSchema } from '../entities/schema-snapshot.interface.js';

export interface DataSourceListItemDto {
  id: string;
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchName: string;
  deviceId: string;
  deviceHostname: string;
  localDataSourceKey: string;
  engine: string;
  databaseName: string;
  declaredSoftwareName: string | null;
  detectedSoftwareName: string | null;
  detectionStatus: string;
  status: string;
  createdAt: string;
  latestSchemaVersion?: number | null;
  latestSchemaFingerprint?: string | null;
  tablesCount?: number;
}

export interface DataSourceDetailsDto extends DataSourceListItemDto {
  latestSchema?: {
    id: string;
    version: number;
    schemaFingerprint: string;
    tables: TableSchema[];
    createdAt: string;
  } | null;
}
