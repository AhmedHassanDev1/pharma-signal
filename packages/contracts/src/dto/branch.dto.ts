import { BranchStatus } from '../enums/branch-status.enum.js';

export interface CreateBranchRequestDto {
  organizationId: string;
  name: string;
  code?: string | null;
}

export interface BranchResponseDto {
  id: string;
  organizationId: string;
  name: string;
  code?: string | null;
  status: BranchStatus;
  createdAt: string;
}
