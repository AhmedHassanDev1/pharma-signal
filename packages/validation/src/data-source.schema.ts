import { z } from 'zod';
import { DatabaseClassification } from '@pharma-signal/contracts';

export const databaseClassificationSchema = z.nativeEnum(DatabaseClassification);

export const registerDataSourceSchema = z.object({
  localDataSourceKey: z.string().min(1, 'localDataSourceKey is required'),
  engine: z.string().min(1, 'engine is required'),
  databaseName: z.string().min(1, 'databaseName is required'),
  branchId: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  device_id: z.string().uuid().optional(),
  declaredSoftwareName: z.string().nullable().optional(),
  detectedSoftwareName: z.string().nullable().optional()
});

export type RegisterDataSourceInput = z.infer<typeof registerDataSourceSchema>;
