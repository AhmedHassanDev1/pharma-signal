import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { EnrollmentToken, EnrollmentTokenStatus, Prisma } from '@prisma/client';

export type EnrollmentTokenWithRelations = Prisma.EnrollmentTokenGetPayload<{
  include: { organization: true; branch: true };
}>;

export interface CreateEnrollmentTokenInput {
  tokenHash: string;
  organizationId: string;
  branchId: string;
  expiresAt: Date;
  status?: EnrollmentTokenStatus;
}

@Injectable()
export class EnrollmentTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateEnrollmentTokenInput): Promise<EnrollmentToken> {
    return this.prisma.enrollmentToken.create({
      data: {
        tokenHash: data.tokenHash,
        organizationId: data.organizationId,
        branchId: data.branchId,
        expiresAt: data.expiresAt,
        status: data.status ?? EnrollmentTokenStatus.ACTIVE
      }
    });
  }

  async findById(id: string): Promise<EnrollmentTokenWithRelations | null> {
    return this.prisma.enrollmentToken.findUnique({
      where: { id },
      include: {
        organization: true,
        branch: true
      }
    });
  }

  async findByTokenHash(tokenHash: string): Promise<EnrollmentTokenWithRelations | null> {
    return this.prisma.enrollmentToken.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
        branch: true
      }
    });
  }

  async updateStatus(
    id: string,
    status: EnrollmentTokenStatus,
    timestamps?: { usedAt?: Date; revokedAt?: Date }
  ): Promise<EnrollmentToken> {
    return this.prisma.enrollmentToken.update({
      where: { id },
      data: {
        status,
        ...(timestamps?.usedAt !== undefined ? { usedAt: timestamps.usedAt } : {}),
        ...(timestamps?.revokedAt !== undefined ? { revokedAt: timestamps.revokedAt } : {})
      }
    });
  }

  /**
   * Atomic consumption of an active token.
   * Uses conditional update to ensure that only an ACTIVE token whose expiresAt > now
   * can be updated to USED. If two concurrent attempts occur, exactly one succeeds.
   */
  async atomicConsume(id: string, now: Date = new Date()): Promise<boolean> {
    const result = await this.prisma.enrollmentToken.updateMany({
      where: {
        id,
        status: EnrollmentTokenStatus.ACTIVE,
        expiresAt: { gt: now }
      },
      data: {
        status: EnrollmentTokenStatus.USED,
        usedAt: now
      }
    });

    return result.count === 1;
  }
}
