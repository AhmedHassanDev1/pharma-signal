import { EnrollmentTokenStatus } from '../enums/enrollment-token-status.enum.js';

export interface EnrollmentToken {
  id: string;
  tokenHash: string;
  organizationId: string;
  branchId: string;
  status: EnrollmentTokenStatus;
  expiresAt: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
}
