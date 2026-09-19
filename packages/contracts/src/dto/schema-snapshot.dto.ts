import { TableSchema } from '../entities/schema-snapshot.interface.js';

export interface UploadSchemaSnapshotRequestDto {
  dataSourceId: string;
  schemaFingerprint: string;
  tables: TableSchema[];
}

export interface UploadSchemaSnapshotResponseDto {
  snapshotId: string;
  dataSourceId: string;
  schemaFingerprint: string;
  version: number;
  isNewVersion: boolean;
}
