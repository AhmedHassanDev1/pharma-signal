export interface RegisterDataSourceRequestDto {
  localDataSourceKey: string;
  engine: string;
  databaseName: string;
}

export interface RegisterDataSourceResponseDto {
  dataSourceId: string;
  tenantId: string;
  deviceId: string;
  localDataSourceKey: string;
  status: string;
}
