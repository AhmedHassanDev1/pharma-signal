import { z } from 'zod';
import { OrganizationRole, OrganizationStatus } from '@pharma-signal/contracts';

export const organizationRoleSchema = z.nativeEnum(OrganizationRole);
export const organizationStatusSchema = z.nativeEnum(OrganizationStatus);

export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'name is required'),
  role: organizationRoleSchema
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
