import { OrganizationRole } from '../enums/organization-role.enum.js';
import { OrganizationStatus } from '../enums/organization-status.enum.js';

export interface CreateOrganizationRequestDto {
  name: string;
  role: OrganizationRole;
}

export interface OrganizationResponseDto {
  id: string;
  name: string;
  role: OrganizationRole;
  status: OrganizationStatus;
  createdAt: string;
}
