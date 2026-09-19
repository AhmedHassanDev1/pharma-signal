import { z } from 'zod';

export const provenanceSchema = z.object({
  tenantId: z.string().uuid(),
  deviceId: z.string().uuid(),
  dataSourceId: z.string().uuid(),
  sourceTable: z.string().min(1),
  sourceId: z.string().min(1),
  extractedAt: z.string().datetime({ message: 'extractedAt must be a valid ISO 8601 UTC datetime string' }),
  hash: z.string().optional()
});

export type ProvenanceInput = z.infer<typeof provenanceSchema>;
