import { OrganizationRole } from '../enums/organization-role.enum.js';
import { OrganizationStatus } from '../enums/organization-status.enum.js';

export interface Organization {
  id: string;
  name: string;
  role: OrganizationRole;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt?: string;
}
