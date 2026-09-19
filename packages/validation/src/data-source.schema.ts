import { z } from 'zod';
import { DatabaseClassification } from '@pharma-signal/contracts';

export const databaseClassificationSchema = z.nativeEnum(DatabaseClassification);

export const registerDataSourceSchema = z.object({
  localDataSourceKey: z.string().min(1, 'localDataSourceKey is required'),
  engine: z.string().min(1, 'engine is required'),
  databaseName: z.string().min(1, 'databaseName is required')
});

export type RegisterDataSourceInput = z.infer<typeof registerDataSourceSchema>;
