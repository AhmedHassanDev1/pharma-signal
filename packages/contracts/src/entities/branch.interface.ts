import { BranchStatus } from '../enums/branch-status.enum.js';

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code?: string | null;
  status: BranchStatus;
  createdAt: string;
  updatedAt?: string;
}
