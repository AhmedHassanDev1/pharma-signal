import { EnrollmentToken, EnrollmentTokenStatus, Organization, Branch } from '@prisma/client';

export { EnrollmentTokenStatus };

export interface CreateEnrollmentTokenParams {
  organizationId: string;
  branchId: string;
  expiresInSeconds?: number;
}

export interface CreateEnrollmentTokenResult {
  rawToken: string;
  token: EnrollmentToken;
}

export interface EnrollmentTokenContext {
  id: string;
  organizationId: string;
  branchId: string;
  status: EnrollmentTokenStatus;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  organization?: Organization;
  branch?: Branch;
}
