import { z } from 'zod';
import { provenanceSchema } from '../provenance.schema.js';

export const canonicalInventorySchema = z.object({
  sourceId: z.string().min(1),
  sourceTable: z.string().min(1),
  productSourceId: z.string().min(1),
  batchSourceId: z.string().nullable().optional(),
  quantity: z.number().nonnegative(),
  unitPrice: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  rawPayload: z.record(z.unknown()).nullable().optional(),
  provenance: provenanceSchema
});

export type CanonicalInventoryInput = z.infer<typeof canonicalInventorySchema>;
