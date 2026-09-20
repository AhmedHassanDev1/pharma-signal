import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { EnrollmentModule } from './enrollment.module.js';
import { EnrollmentTokenService } from './enrollment-token.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  EnrollmentTokenStatus
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('EnrollmentToken Integration Tests', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let enrollmentTokenService: EnrollmentTokenService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, OrganizationsModule, EnrollmentModule]
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    enrollmentTokenService = moduleRef.get<EnrollmentTokenService>(EnrollmentTokenService);

    await prisma.onModuleInit();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('should create, verify, consume, and prevent double consumption against PostgreSQL', async () => {
    // 1. Create Organization
    const org = await prisma.organization.create({
      data: {
        name: 'Integration Test Health Org',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    // 2. Create Branch
    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Integration Branch Alpha',
        code: 'INT-BR-01',
        status: BranchStatus.ACTIVE
      }
    });

    // 3. Create Enrollment Token
    const createResult = await enrollmentTokenService.createToken({
      organizationId: org.id,
      branchId: branch.id,
      expiresInSeconds: 3600
    });

    expect(createResult.rawToken).toBeDefined();
    expect(createResult.rawToken.startsWith('ps_et_')).toBe(true);
    expect(createResult.token.id).toBeDefined();
    expect(createResult.token.status).toBe(EnrollmentTokenStatus.ACTIVE);

    // Verify raw token is NOT in the database; only tokenHash
    const dbRecord = await prisma.enrollmentToken.findUnique({
      where: { id: createResult.token.id }
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.tokenHash).toBe(enrollmentTokenService.hashToken(createResult.rawToken));
    expect(dbRecord?.tokenHash).not.toBe(createResult.rawToken);

    // 4. Verify Token
    const verifiedContext = await enrollmentTokenService.verifyToken(createResult.rawToken);
    expect(verifiedContext.id).toBe(createResult.token.id);
    expect(verifiedContext.organizationId).toBe(org.id);
    expect(verifiedContext.branchId).toBe(branch.id);
    expect(verifiedContext.status).toBe(EnrollmentTokenStatus.ACTIVE);
    expect(verifiedContext.organization?.name).toBe('Integration Test Health Org');
    expect(verifiedContext.branch?.name).toBe('Integration Branch Alpha');

    // 5. Consume Token (ACTIVE -> USED)
    const consumedContext = await enrollmentTokenService.consumeToken(createResult.rawToken);
    expect(consumedContext.id).toBe(createResult.token.id);
    expect(consumedContext.status).toBe(EnrollmentTokenStatus.USED);
    expect(consumedContext.usedAt).toBeDefined();

    // Verify database state after consumption
    const consumedDb = await prisma.enrollmentToken.findUnique({
      where: { id: createResult.token.id }
    });
    expect(consumedDb?.status).toBe(EnrollmentTokenStatus.USED);
    expect(consumedDb?.usedAt).not.toBeNull();

    // 6. Second consume attempt must fail (double-use prevention)
    await expect(enrollmentTokenService.consumeToken(createResult.rawToken)).rejects.toThrow(
      BadRequestException
    );

    // Verify after-consumption verification also fails
    await expect(enrollmentTokenService.verifyToken(createResult.rawToken)).rejects.toThrow(
      'Enrollment token has already been used'
    );

    // Cleanup: Cascade delete
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('should enforce concurrency safety when two requests consume the same token simultaneously', async () => {
    // 1. Setup Org & Branch
    const org = await prisma.organization.create({
      data: {
        name: 'Concurrent Test Org',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });
    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Concurrent Branch',
        status: BranchStatus.ACTIVE
      }
    });

    // 2. Create Token
    const { rawToken, token } = await enrollmentTokenService.createToken({
      organizationId: org.id,
      branchId: branch.id,
      expiresInSeconds: 3600
    });

    // 3. Fire two concurrent consume requests simultaneously
    const [result1, result2] = await Promise.allSettled([
      enrollmentTokenService.consumeToken(rawToken),
      enrollmentTokenService.consumeToken(rawToken)
    ]);

    // Exactly one request must succeed, and exactly one request must be rejected
    const fulfilled = [result1, result2].filter((r) => r.status === 'fulfilled');
    const rejected = [result1, result2].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The token in DB must be USED
    const finalToken = await prisma.enrollmentToken.findUnique({ where: { id: token.id } });
    expect(finalToken?.status).toBe(EnrollmentTokenStatus.USED);
    expect(finalToken?.usedAt).not.toBeNull();

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('should revoke an active token and reject subsequent verification and consumption', async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Revocation Test Org',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });
    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Revocation Branch',
        status: BranchStatus.ACTIVE
      }
    });

    const { rawToken, token } = await enrollmentTokenService.createToken({
      organizationId: org.id,
      branchId: branch.id,
      expiresInSeconds: 3600
    });

    // Revoke token
    const revoked = await enrollmentTokenService.revokeToken(token.id);
    expect(revoked.status).toBe(EnrollmentTokenStatus.REVOKED);
    expect(revoked.revokedAt).not.toBeNull();

    // Verification must fail
    await expect(enrollmentTokenService.verifyToken(rawToken)).rejects.toThrow(
      'Enrollment token has been revoked'
    );

    // Consumption must fail
    await expect(enrollmentTokenService.consumeToken(rawToken)).rejects.toThrow(
      'Enrollment token has been revoked'
    );

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('should expire tokens and lazily update status to EXPIRED', async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Expiration Test Org',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });
    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Expiration Branch',
        status: BranchStatus.ACTIVE
      }
    });

    const { rawToken, token } = await enrollmentTokenService.createToken({
      organizationId: org.id,
      branchId: branch.id,
      expiresInSeconds: 3600
    });

    // Manually backdate expiresAt in DB to simulate expiration
    await prisma.enrollmentToken.update({
      where: { id: token.id },
      data: { expiresAt: new Date(Date.now() - 60000) } // 1 minute ago
    });

    // Verification must fail with expiration error
    await expect(enrollmentTokenService.verifyToken(rawToken)).rejects.toThrow(
      'Enrollment token has expired'
    );

    // Status in DB must now be EXPIRED (lazily updated)
    const expiredDb = await prisma.enrollmentToken.findUnique({ where: { id: token.id } });
    expect(expiredDb?.status).toBe(EnrollmentTokenStatus.EXPIRED);

    // Consumption must also fail
    await expect(enrollmentTokenService.consumeToken(rawToken)).rejects.toThrow(
      'Enrollment token has expired'
    );

    // Revoking an expired token must fail
    await expect(enrollmentTokenService.revokeToken(token.id)).rejects.toThrow(
      'Cannot revoke an expired enrollment token'
    );

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
