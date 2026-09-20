import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EnrollmentTokenService } from './enrollment-token.service.js';
import {
  EnrollmentTokenRepository,
  EnrollmentTokenWithRelations,
  CreateEnrollmentTokenInput
} from './enrollment-token.repository.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import {
  EnrollmentToken,
  EnrollmentTokenStatus,
  OrganizationStatus,
  BranchStatus,
  OrganizationRole
} from '@prisma/client';

describe('EnrollmentTokenService', () => {
  let service: EnrollmentTokenService;
  let repositoryMock: {
    create: ReturnType<typeof jest.fn<(data: CreateEnrollmentTokenInput) => Promise<EnrollmentToken>>>;
    findById: ReturnType<typeof jest.fn<(id: string) => Promise<EnrollmentTokenWithRelations | null>>>;
    findByTokenHash: ReturnType<typeof jest.fn<(hash: string) => Promise<EnrollmentTokenWithRelations | null>>>;
    updateStatus: ReturnType<
      typeof jest.fn<
        (
          id: string,
          status: EnrollmentTokenStatus,
          timestamps?: { usedAt?: Date; revokedAt?: Date }
        ) => Promise<EnrollmentToken>
      >
    >;
    atomicConsume: ReturnType<typeof jest.fn<(id: string, now?: Date) => Promise<boolean>>>;
  };
  let organizationsServiceMock: {
    validateBranchOwnership: ReturnType<typeof jest.fn<(orgId: string, branchId: string) => Promise<any>>>;
  };

  const mockOrg = {
    id: 'org-uuid-1',
    name: 'Al-Amal Pharmacy',
    role: OrganizationRole.RETAIL_PHARMACY,
    status: OrganizationStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockBranch = {
    id: 'branch-uuid-1',
    organizationId: 'org-uuid-1',
    name: 'Main Branch',
    code: 'MAIN-01',
    status: BranchStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const createMockToken = (overrides?: Partial<EnrollmentTokenWithRelations>): EnrollmentTokenWithRelations => ({
    id: 'token-uuid-1',
    tokenHash: 'dummy-sha256-hash',
    organizationId: 'org-uuid-1',
    branchId: 'branch-uuid-1',
    status: EnrollmentTokenStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 86400 * 1000), // +24 hours
    usedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    organization: mockOrg,
    branch: mockBranch,
    ...overrides
  });

  beforeEach(async () => {
    repositoryMock = {
      create: jest.fn<(data: CreateEnrollmentTokenInput) => Promise<EnrollmentToken>>().mockImplementation(async (data) => ({
        id: 'token-uuid-created',
        tokenHash: data.tokenHash,
        organizationId: data.organizationId,
        branchId: data.branchId,
        status: data.status ?? EnrollmentTokenStatus.ACTIVE,
        expiresAt: data.expiresAt,
        usedAt: null,
        revokedAt: null,
        createdAt: new Date()
      })),
      findById: jest.fn<(id: string) => Promise<EnrollmentTokenWithRelations | null>>().mockResolvedValue(createMockToken()),
      findByTokenHash: jest.fn<(hash: string) => Promise<EnrollmentTokenWithRelations | null>>().mockResolvedValue(createMockToken()),
      updateStatus: jest.fn<
        (
          id: string,
          status: EnrollmentTokenStatus,
          timestamps?: { usedAt?: Date; revokedAt?: Date }
        ) => Promise<EnrollmentToken>
      >().mockImplementation(async (id, status, timestamps) => ({
        ...createMockToken({ id }),
        status,
        usedAt: timestamps?.usedAt ?? null,
        revokedAt: timestamps?.revokedAt ?? null
      })),
      atomicConsume: jest.fn<(id: string, now?: Date) => Promise<boolean>>().mockResolvedValue(true)
    };

    organizationsServiceMock = {
      validateBranchOwnership: jest.fn<(orgId: string, branchId: string) => Promise<any>>().mockResolvedValue({
        organization: mockOrg,
        branch: mockBranch
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentTokenService,
        {
          provide: EnrollmentTokenRepository,
          useValue: repositoryMock
        },
        {
          provide: OrganizationsService,
          useValue: organizationsServiceMock
        }
      ]
    }).compile();

    service = module.get<EnrollmentTokenService>(EnrollmentTokenService);
  });

  describe('Token Creation', () => {
    it('should generate a valid cryptographically secure token and store only the hash', async () => {
      const result = await service.createToken({
        organizationId: 'org-uuid-1',
        branchId: 'branch-uuid-1'
      });

      expect(result.rawToken).toBeDefined();
      expect(result.rawToken.startsWith('ps_et_')).toBe(true);
      expect(result.rawToken.length).toBeGreaterThan(32);

      // Verify repository received hash, NOT raw token
      expect(repositoryMock.create).toHaveBeenCalledTimes(1);
      const createArg = repositoryMock.create.mock.calls[0]![0];
      expect(createArg.tokenHash).not.toBe(result.rawToken);
      expect(createArg.tokenHash).toBe(service.hashToken(result.rawToken));
      expect(createArg.organizationId).toBe('org-uuid-1');
      expect(createArg.branchId).toBe('branch-uuid-1');
      expect(createArg.status).toBe(EnrollmentTokenStatus.ACTIVE);

      // Verify organization ownership validation was performed
      expect(organizationsServiceMock.validateBranchOwnership).toHaveBeenCalledWith(
        'org-uuid-1',
        'branch-uuid-1'
      );
    });

    it('should reject creation if expiresInSeconds is not positive', async () => {
      await expect(
        service.createToken({
          organizationId: 'org-uuid-1',
          branchId: 'branch-uuid-1',
          expiresInSeconds: 0
        })
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createToken({
          organizationId: 'org-uuid-1',
          branchId: 'branch-uuid-1',
          expiresInSeconds: -100
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if organization is inactive or branch does not belong', async () => {
      organizationsServiceMock.validateBranchOwnership.mockRejectedValueOnce(
        new BadRequestException('Organization is not in ACTIVE status')
      );

      await expect(
        service.createToken({
          organizationId: 'org-suspended',
          branchId: 'branch-uuid-1'
        })
      ).rejects.toThrow(BadRequestException);

      expect(repositoryMock.create).not.toHaveBeenCalled();
    });
  });

  describe('Token Verification', () => {
    it('should successfully verify an active, unexpired token with valid organization/branch', async () => {
      const rawToken = 'ps_et_test_token_12345';
      const expectedHash = service.hashToken(rawToken);

      const mockToken = createMockToken({ tokenHash: expectedHash });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(mockToken);

      const context = await service.verifyToken(rawToken);

      expect(context.id).toBe(mockToken.id);
      expect(context.organizationId).toBe('org-uuid-1');
      expect(context.branchId).toBe('branch-uuid-1');
      expect(context.status).toBe(EnrollmentTokenStatus.ACTIVE);
      expect(organizationsServiceMock.validateBranchOwnership).toHaveBeenCalledWith(
        'org-uuid-1',
        'branch-uuid-1'
      );
    });

    it('should reject verification if token does not exist', async () => {
      repositoryMock.findByTokenHash.mockResolvedValue(null);

      await expect(service.verifyToken('ps_et_nonexistent')).rejects.toThrow(
        BadRequestException
      );
      await expect(service.verifyToken('ps_et_nonexistent')).rejects.toThrow(
        'Invalid enrollment token'
      );
    });

    it('should reject verification if raw token is empty or invalid type', async () => {
      await expect(service.verifyToken('')).rejects.toThrow(BadRequestException);
      // @ts-expect-error test invalid type
      await expect(service.verifyToken(null)).rejects.toThrow(BadRequestException);
    });

    it('should reject verification and lazily update status if token is expired', async () => {
      const expiredToken = createMockToken({
        expiresAt: new Date(Date.now() - 1000), // in the past
        status: EnrollmentTokenStatus.ACTIVE
      });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(expiredToken);

      await expect(service.verifyToken('ps_et_expired_token')).rejects.toThrow(
        'Enrollment token has expired'
      );

      expect(repositoryMock.updateStatus).toHaveBeenCalledWith(
        expiredToken.id,
        EnrollmentTokenStatus.EXPIRED
      );
    });

    it('should reject verification if token status is USED', async () => {
      const usedToken = createMockToken({
        status: EnrollmentTokenStatus.USED,
        usedAt: new Date()
      });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(usedToken);

      await expect(service.verifyToken('ps_et_used_token')).rejects.toThrow(
        'Enrollment token has already been used'
      );
    });

    it('should reject verification if token status is REVOKED', async () => {
      const revokedToken = createMockToken({
        status: EnrollmentTokenStatus.REVOKED,
        revokedAt: new Date()
      });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(revokedToken);

      await expect(service.verifyToken('ps_et_revoked_token')).rejects.toThrow(
        'Enrollment token has been revoked'
      );
    });

    it('should reject verification if token status is already EXPIRED', async () => {
      const expiredToken = createMockToken({
        status: EnrollmentTokenStatus.EXPIRED
      });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(expiredToken);

      await expect(service.verifyToken('ps_et_expired_status')).rejects.toThrow(
        'Enrollment token has expired'
      );
    });

    it('should reject verification if organization or branch becomes inactive', async () => {
      organizationsServiceMock.validateBranchOwnership.mockRejectedValueOnce(
        new BadRequestException('Organization is not in ACTIVE status')
      );

      await expect(service.verifyToken('ps_et_active_token')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Token Consumption', () => {
    it('should transition ACTIVE -> USED on successful consumption', async () => {
      const rawToken = 'ps_et_valid_to_consume';
      const mockToken = createMockToken({ tokenHash: service.hashToken(rawToken) });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(mockToken);

      const context = await service.consumeToken(rawToken);

      expect(context.status).toBe(EnrollmentTokenStatus.USED);
      expect(context.usedAt).toBeDefined();
      expect(repositoryMock.atomicConsume).toHaveBeenCalledWith(mockToken.id, expect.any(Date));
    });

    it('should reject second consumption attempt if already USED', async () => {
      const usedToken = createMockToken({
        status: EnrollmentTokenStatus.USED,
        usedAt: new Date()
      });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(usedToken);

      await expect(service.consumeToken('ps_et_already_used')).rejects.toThrow(
        'Enrollment token has already been used'
      );
      expect(repositoryMock.atomicConsume).not.toHaveBeenCalled();
    });

    it('should reject consumption if token is expired', async () => {
      const expiredToken = createMockToken({
        expiresAt: new Date(Date.now() - 5000),
        status: EnrollmentTokenStatus.ACTIVE
      });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(expiredToken);

      await expect(service.consumeToken('ps_et_expired')).rejects.toThrow(
        'Enrollment token has expired'
      );
      expect(repositoryMock.updateStatus).toHaveBeenCalledWith(
        expiredToken.id,
        EnrollmentTokenStatus.EXPIRED
      );
      expect(repositoryMock.atomicConsume).not.toHaveBeenCalled();
    });

    it('should reject consumption if token is REVOKED', async () => {
      const revokedToken = createMockToken({
        status: EnrollmentTokenStatus.REVOKED,
        revokedAt: new Date()
      });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(revokedToken);

      await expect(service.consumeToken('ps_et_revoked')).rejects.toThrow(
        'Enrollment token has been revoked'
      );
      expect(repositoryMock.atomicConsume).not.toHaveBeenCalled();
    });

    it('should fail if atomic conditional update returns false (race condition / concurrency)', async () => {
      const rawToken = 'ps_et_concurrent_race';
      const mockToken = createMockToken({ tokenHash: service.hashToken(rawToken) });
      repositoryMock.findByTokenHash.mockResolvedValueOnce(mockToken);
      repositoryMock.atomicConsume.mockResolvedValueOnce(false); // race condition: someone else consumed it first!

      await expect(service.consumeToken(rawToken)).rejects.toThrow(
        'Enrollment token has already been used or cannot be consumed'
      );
    });
  });

  describe('Token Revocation', () => {
    it('should transition ACTIVE -> REVOKED', async () => {
      const mockToken = createMockToken({ status: EnrollmentTokenStatus.ACTIVE });
      repositoryMock.findById.mockResolvedValueOnce(mockToken);

      const revoked = await service.revokeToken(mockToken.id);

      expect(revoked.status).toBe(EnrollmentTokenStatus.REVOKED);
      expect(repositoryMock.updateStatus).toHaveBeenCalledWith(
        mockToken.id,
        EnrollmentTokenStatus.REVOKED,
        { revokedAt: expect.any(Date) }
      );
    });

    it('should be idempotent when revoking an already REVOKED token', async () => {
      const revokedToken = createMockToken({
        status: EnrollmentTokenStatus.REVOKED,
        revokedAt: new Date()
      });
      repositoryMock.findById.mockResolvedValueOnce(revokedToken);

      const result = await service.revokeToken(revokedToken.id);

      expect(result.status).toBe(EnrollmentTokenStatus.REVOKED);
      expect(repositoryMock.updateStatus).not.toHaveBeenCalled();
    });

    it('should reject revoking a USED token', async () => {
      const usedToken = createMockToken({
        status: EnrollmentTokenStatus.USED,
        usedAt: new Date()
      });
      repositoryMock.findById.mockResolvedValueOnce(usedToken);

      await expect(service.revokeToken(usedToken.id)).rejects.toThrow(
        'Cannot revoke an already used enrollment token'
      );
      expect(repositoryMock.updateStatus).not.toHaveBeenCalled();
    });

    it('should reject revoking an EXPIRED token', async () => {
      const expiredToken = createMockToken({
        status: EnrollmentTokenStatus.EXPIRED
      });
      repositoryMock.findById.mockResolvedValueOnce(expiredToken);

      await expect(service.revokeToken(expiredToken.id)).rejects.toThrow(
        'Cannot revoke an expired enrollment token'
      );
      expect(repositoryMock.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if token ID does not exist', async () => {
      repositoryMock.findById.mockResolvedValueOnce(null);

      await expect(service.revokeToken('nonexistent-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
