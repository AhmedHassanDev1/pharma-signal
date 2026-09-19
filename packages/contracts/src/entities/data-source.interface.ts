export interface DataSource {
  id: string;
  tenantId: string;
  deviceId: string;
  localDataSourceKey: string;
  engine: string;
  databaseName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
