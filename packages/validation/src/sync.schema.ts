import { z } from 'zod';
import { canonicalProductSchema } from './canonical/product.schema.js';
import { canonicalBatchSchema } from './canonical/batch.schema.js';
import { canonicalInventorySchema } from './canonical/inventory.schema.js';
import { canonicalSupplierSchema } from './canonical/supplier.schema.js';

export const syncRecordPayloadSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    sourceId: z.string().min(1),
    sourceTable: z.string().min(1),
    data: dataSchema,
    provenance: z.object({
      tenantId: z.string().uuid(),
      deviceId: z.string().uuid(),
      dataSourceId: z.string().uuid(),
      sourceTable: z.string().min(1),
      sourceId: z.string().min(1),
      extractedAt: z.string().datetime(),
      hash: z.string().optional()
    })
  });

export const canonicalSyncSchema = z.object({
  dataSourceId: z.string().uuid('dataSourceId must be a valid UUID'),
  syncBatchId: z.string().uuid('syncBatchId must be a valid UUID'),
  products: z.array(syncRecordPayloadSchema(canonicalProductSchema.omit({ provenance: true }))).optional().default([]),
  batches: z.array(syncRecordPayloadSchema(canonicalBatchSchema.omit({ provenance: true }))).optional().default([]),
  inventories: z.array(syncRecordPayloadSchema(canonicalInventorySchema.omit({ provenance: true }))).optional().default([]),
  suppliers: z.array(syncRecordPayloadSchema(canonicalSupplierSchema.omit({ provenance: true }))).optional().default([])
});

export type CanonicalSyncInput = z.infer<typeof canonicalSyncSchema>;
