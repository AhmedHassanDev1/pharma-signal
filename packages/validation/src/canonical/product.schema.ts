import { z } from 'zod';
import { provenanceSchema } from '../provenance.schema.js';

export const canonicalProductSchema = z.object({
  sourceId: z.string().min(1),
  sourceTable: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  rawPayload: z.record(z.unknown()).nullable().optional(),
  provenance: provenanceSchema
});

export type CanonicalProductInput = z.infer<typeof canonicalProductSchema>;
