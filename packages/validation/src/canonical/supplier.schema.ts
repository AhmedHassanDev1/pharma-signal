import { z } from 'zod';
import { provenanceSchema } from '../provenance.schema.js';

export const canonicalSupplierSchema = z.object({
  sourceId: z.string().min(1),
  sourceTable: z.string().min(1),
  name: z.string().min(1),
  contact: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  rawPayload: z.record(z.unknown()).nullable().optional(),
  provenance: provenanceSchema
});

export type CanonicalSupplierInput = z.infer<typeof canonicalSupplierSchema>;
