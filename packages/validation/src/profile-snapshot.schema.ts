import { z } from 'zod';
import { DatabaseClassification } from '@pharma-signal/contracts';

export const uploadProfileSnapshotSchema = z.object({
  dataSourceId: z.string().uuid('dataSourceId must be a valid UUID'),
  schemaFingerprint: z.string().length(64, 'schemaFingerprint must be a 64-character hex string (SHA-256)'),
  classification: z.nativeEnum(DatabaseClassification),
  confidence: z.number().min(0).max(1),
  evidence: z.record(z.unknown()).default({}),
  reason: z.string().min(1, 'reason is required')
});

export type UploadProfileSnapshotInput = z.infer<typeof uploadProfileSnapshotSchema>;
