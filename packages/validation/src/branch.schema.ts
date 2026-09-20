import { z } from 'zod';
import { BranchStatus } from '@pharma-signal/contracts';

export const branchStatusSchema = z.nativeEnum(BranchStatus);

export const createBranchSchema = z.object({
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  name: z.string().min(1, 'name is required'),
  code: z.string().nullable().optional()
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
