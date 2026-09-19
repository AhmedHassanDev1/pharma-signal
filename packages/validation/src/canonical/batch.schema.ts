import { z } from 'zod';
import { provenanceSchema } from '../provenance.schema.js';

export const canonicalBatchSchema = z.object({
  sourceId: z.string().min(1),
  sourceTable: z.string().min(1),
  productSourceId: z.string().min(1),
  batchNumber: z.string().min(1),
  expiryDate: z.string().nullable().optional(),
  manufacturingDate: z.string().nullable().optional(),
  rawPayload: z.record(z.unknown()).nullable().optional(),
  provenance: provenanceSchema
});

export type CanonicalBatchInput = z.infer<typeof canonicalBatchSchema>;
