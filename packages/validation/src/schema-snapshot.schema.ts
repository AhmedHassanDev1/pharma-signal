import { z } from 'zod';

export const columnSchemaValidator = z.object({
  name: z.string().min(1),
  dataType: z.string().min(1),
  isNullable: z.boolean(),
  isPrimaryKey: z.boolean(),
  defaultValue: z.string().nullable().optional(),
  maxLength: z.number().nullable().optional()
});

export const foreignKeySchemaValidator = z.object({
  columnName: z.string().min(1),
  referencedTable: z.string().min(1),
  referencedColumn: z.string().min(1),
  constraintName: z.string().nullable().optional()
});

export const indexSchemaValidator = z.object({
  name: z.string().min(1),
  columns: z.array(z.string().min(1)),
  isUnique: z.boolean()
});

export const tableSchemaValidator = z.object({
  name: z.string().min(1),
  columns: z.array(columnSchemaValidator),
  primaryKey: z.array(z.string()),
  foreignKeys: z.array(foreignKeySchemaValidator).optional(),
  indexes: z.array(indexSchemaValidator).optional(),
  rowCountEstimate: z.number().nullable().optional()
});

export const uploadSchemaSnapshotSchema = z.object({
  dataSourceId: z.string().uuid('dataSourceId must be a valid UUID'),
  schemaFingerprint: z.string().length(64, 'schemaFingerprint must be a 64-character hex string (SHA-256)'),
  tables: z.array(tableSchemaValidator)
});

export type UploadSchemaSnapshotInput = z.infer<typeof uploadSchemaSnapshotSchema>;
