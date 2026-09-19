export interface ColumnSchema {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string | null;
  maxLength?: number | null;
}

export interface ForeignKeySchema {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName?: string | null;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKey: string[];
  foreignKeys?: ForeignKeySchema[];
  indexes?: IndexSchema[];
  rowCountEstimate?: number | null;
}

export interface SchemaSnapshot {
  id: string;
  dataSourceId: string;
  schemaFingerprint: string;
  tables: TableSchema[];
  version: number;
  isNewVersion: boolean;
  createdAt: string;
}
