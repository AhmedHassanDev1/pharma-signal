import {
  Injectable,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import crypto from 'node:crypto';
import { EnrollmentToken, EnrollmentTokenStatus } from '@prisma/client';
import { EnrollmentTokenRepository, EnrollmentTokenWithRelations } from './enrollment-token.repository.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import {
  CreateEnrollmentTokenParams,
  CreateEnrollmentTokenResult,
  EnrollmentTokenContext
} from './enrollment-token.types.js';

@Injectable()
export class EnrollmentTokenService {
  constructor(
    private readonly repository: EnrollmentTokenRepository,
    private readonly organizationsService: OrganizationsService
  ) {}

  /**
   * Hashes a raw enrollment token using SHA-256.
   * Only the hash is ever stored in the database or used for comparison.
   */
  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Creates a new cryptographically secure enrollment token bound to an organization and branch.
   * 
   * Validation & Security Rules:
   * 1. Validates that organization exists and is ACTIVE.
   * 2. Validates that branch exists, belongs to the organization, and is ACTIVE.
   * 3. Generates 256-bit cryptographically secure random secret (prefixed with ps_et_).
   * 4. Persists only token_hash in PostgreSQL. Raw token is returned in result and never stored.
   */
  async createToken(params: CreateEnrollmentTokenParams): Promise<CreateEnrollmentTokenResult> {
    // 1. Verify server-side organization and branch active state & ownership
    await this.organizationsService.validateBranchOwnership(
      params.organizationId,
      params.branchId
    );

    // 2. Generate cryptographically secure random token (256 bits entropy)
    const rawToken = `ps_et_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);

    // 3. Compute expiration time (default 24 hours = 86400 seconds)
    const expiresInSeconds = params.expiresInSeconds ?? 86400;
    if (expiresInSeconds <= 0) {
      throw new BadRequestException('Token expiration duration must be positive');
    }
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 4. Persist token record with hash only
    const token = await this.repository.create({
      tokenHash,
      organizationId: params.organizationId,
      branchId: params.branchId,
      expiresAt,
      status: EnrollmentTokenStatus.ACTIVE
    });

    return {
      rawToken,
      token
    };
  }

  /**
   * Verifies an enrollment token and returns its context.
   * 
   * Verification Rules:
   * 1. Computes hash and performs safe lookup.
   * 2. Token must exist and be in ACTIVE status.
   * 3. Token must not be expired (expires_at > now).
   * 4. If token is expired, status is lazily transitioned to EXPIRED.
   * 5. Validates organization and branch active state and ownership.
   * 6. Context is derived solely from the server-persisted token (never trusts client inputs).
   */
  async verifyToken(rawToken: string): Promise<EnrollmentTokenContext> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Invalid enrollment token');
    }

    const tokenHash = this.hashToken(rawToken);
    const token = await this.repository.findByTokenHash(tokenHash);

    if (!token) {
      throw new BadRequestException('Invalid enrollment token');
    }

    const now = new Date();

    // Check expiration
    if (token.expiresAt <= now) {
      if (token.status === EnrollmentTokenStatus.ACTIVE) {
        await this.repository.updateStatus(token.id, EnrollmentTokenStatus.EXPIRED);
      }
      throw new BadRequestException('Enrollment token has expired');
    }

    // Check status lifecycle
    if (token.status === EnrollmentTokenStatus.USED) {
      throw new BadRequestException('Enrollment token has already been used');
    }

    if (token.status === EnrollmentTokenStatus.REVOKED) {
      throw new BadRequestException('Enrollment token has been revoked');
    }

    if (token.status === EnrollmentTokenStatus.EXPIRED) {
      throw new BadRequestException('Enrollment token has expired');
    }

    if (token.status !== EnrollmentTokenStatus.ACTIVE) {
      throw new BadRequestException('Enrollment token is not active');
    }

    // Verify organization and branch ownership and active state
    const { organization, branch } = await this.organizationsService.validateBranchOwnership(
      token.organizationId,
      token.branchId
    );

    return {
      id: token.id,
      organizationId: token.organizationId,
      branchId: token.branchId,
      status: token.status,
      expiresAt: token.expiresAt,
      usedAt: token.usedAt,
      revokedAt: token.revokedAt,
      createdAt: token.createdAt,
      organization,
      branch
    };
  }

  /**
   * Atomically consumes an enrollment token:
   * ACTIVE -> USED, sets used_at = now.
   * 
   * Concurrency & Race-condition Safety:
   * - Uses conditional database update ensuring only ACTIVE and unexpired token can transition to USED.
   * - Under concurrent consume attempts, exactly one request succeeds.
   * - Prevents double use, reuse after expiration, and reuse after revocation.
   */
  async consumeToken(rawToken: string): Promise<EnrollmentTokenContext> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Invalid enrollment token');
    }

    const tokenHash = this.hashToken(rawToken);
    const token = await this.repository.findByTokenHash(tokenHash);

    if (!token) {
      throw new BadRequestException('Invalid enrollment token');
    }

    const now = new Date();

    // Check expiration
    if (token.expiresAt <= now) {
      if (token.status === EnrollmentTokenStatus.ACTIVE) {
        await this.repository.updateStatus(token.id, EnrollmentTokenStatus.EXPIRED);
      }
      throw new BadRequestException('Enrollment token has expired');
    }

    // Check status lifecycle
    if (token.status === EnrollmentTokenStatus.USED) {
      throw new BadRequestException('Enrollment token has already been used');
    }

    if (token.status === EnrollmentTokenStatus.REVOKED) {
      throw new BadRequestException('Enrollment token has been revoked');
    }

    if (token.status === EnrollmentTokenStatus.EXPIRED) {
      throw new BadRequestException('Enrollment token has expired');
    }

    if (token.status !== EnrollmentTokenStatus.ACTIVE) {
      throw new BadRequestException('Enrollment token is not active');
    }

    // Validate organization and branch ownership and active status
    const { organization, branch } = await this.organizationsService.validateBranchOwnership(
      token.organizationId,
      token.branchId
    );

    // Atomic conditional update to prevent concurrent double-consumption
    const consumed = await this.repository.atomicConsume(token.id, now);
    if (!consumed) {
      throw new BadRequestException('Enrollment token has already been used or cannot be consumed');
    }

    return {
      id: token.id,
      organizationId: token.organizationId,
      branchId: token.branchId,
      status: EnrollmentTokenStatus.USED,
      expiresAt: token.expiresAt,
      usedAt: now,
      revokedAt: token.revokedAt,
      createdAt: token.createdAt,
      organization,
      branch
    };
  }

  /**
   * Revokes an active enrollment token:
   * ACTIVE -> REVOKED, sets revoked_at = now.
   * 
   * Lifecycle Rules:
   * - ACTIVE -> REVOKED
   * - REVOKED -> idempotent return
   * - USED -> cannot revoke (terminal state)
   * - EXPIRED -> cannot revoke (terminal state)
   */
  async revokeToken(id: string): Promise<EnrollmentToken> {
    const token = await this.repository.findById(id);

    if (!token) {
      throw new NotFoundException(`Enrollment token with ID '${id}' not found`);
    }

    if (token.status === EnrollmentTokenStatus.REVOKED) {
      return token; // Idempotent
    }

    if (token.status === EnrollmentTokenStatus.USED) {
      throw new BadRequestException('Cannot revoke an already used enrollment token');
    }

    const now = new Date();
    if (token.status === EnrollmentTokenStatus.EXPIRED || token.expiresAt <= now) {
      if (token.status === EnrollmentTokenStatus.ACTIVE) {
        await this.repository.updateStatus(token.id, EnrollmentTokenStatus.EXPIRED);
      }
      throw new BadRequestException('Cannot revoke an expired enrollment token');
    }

    if (token.status !== EnrollmentTokenStatus.ACTIVE) {
      throw new BadRequestException(`Cannot revoke token with status '${token.status}'`);
    }

    return this.repository.updateStatus(token.id, EnrollmentTokenStatus.REVOKED, {
      revokedAt: now
    });
  }

  /**
   * Retrieves enrollment token by ID (without exposing raw secret, which is not stored).
   */
  async getTokenById(id: string): Promise<EnrollmentTokenWithRelations> {
    const token = await this.repository.findById(id);
    if (!token) {
      throw new NotFoundException(`Enrollment token with ID '${id}' not found`);
    }
    return token;
  }
}
