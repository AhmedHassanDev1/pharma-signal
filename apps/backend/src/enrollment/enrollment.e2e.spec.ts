import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { EnrollmentTokenService } from './enrollment-token.service.js';
import { DeviceCredentialService } from './device-credential.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  EnrollmentTokenStatus,
  DeviceStatus
} from '@prisma/client';
import { EnrollDeviceRequestDto } from '@pharma-signal/contracts';

describe('Enrollment Endpoint E2E (POST /api/v1/agent/enroll)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let enrollmentTokenService: EnrollmentTokenService;
  let deviceCredentialService: DeviceCredentialService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    prisma = app.get<PrismaService>(PrismaService);
    enrollmentTokenService = app.get<EnrollmentTokenService>(EnrollmentTokenService);
    deviceCredentialService = app.get<DeviceCredentialService>(DeviceCredentialService);

    await app.init();
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? address : address.port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should successfully enroll a device via POST /api/v1/agent/enroll and issue credentials', async () => {
    // 1. Setup Organization & Branch in PostgreSQL
    const org = await prisma.organization.create({
      data: {
        name: 'E2E Health Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'E2E Branch 1',
        code: `E2E-BR-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    // 2. Generate Enrollment Token
    const { rawToken, token } = await enrollmentTokenService.createToken({
      organizationId: org.id,
      branchId: branch.id,
      expiresInSeconds: 3600
    });

    const agentInstanceId = randomUUID();

    const payload: EnrollDeviceRequestDto = {
      enrollmentToken: rawToken,
      agentInstanceId,
      hostname: 'E2E-TERMINAL-01',
      os: 'Windows 11 Enterprise',
      appVersion: '0.1.0'
    };

    // 3. Invoke POST /api/v1/agent/enroll
    const response = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);

    const data = (await response.json()) as any;
    expect(data.deviceId).toBeDefined();
    expect(data.organizationId).toBe(org.id);
    expect(data.branchId).toBe(branch.id);
    expect(data.deviceToken).toBeDefined();
    expect(data.status).toBe(DeviceStatus.ACTIVE);
    expect(data.tenantId).toBe(org.id);

    // 4. Verify token is now USED in DB
    const dbToken = await prisma.enrollmentToken.findUnique({ where: { id: token.id } });
    expect(dbToken?.status).toBe(EnrollmentTokenStatus.USED);
    expect(dbToken?.usedAt).not.toBeNull();

    // 5. Verify device exists in DB
    const dbDevice = await prisma.device.findUnique({ where: { id: data.deviceId } });
    expect(dbDevice).not.toBeNull();
    expect(dbDevice?.agentInstanceId).toBe(agentInstanceId);
    expect(dbDevice?.status).toBe(DeviceStatus.ACTIVE);

    // 6. Verify device token is valid and verifiable by DeviceCredentialService
    const verifiedPayload = deviceCredentialService.verifyDeviceToken(data.deviceToken);
    expect(verifiedPayload.deviceId).toBe(data.deviceId);
    expect(verifiedPayload.organizationId).toBe(org.id);
    expect(verifiedPayload.branchId).toBe(branch.id);
    expect(verifiedPayload.agentInstanceId).toBe(agentInstanceId);

    // 7. Attempting to enroll again with the same consumed token must fail (400)
    const secondResponse = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    expect(secondResponse.status).toBe(400);

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('should return 400 Bad Request when enrollment token is invalid or non-existent', async () => {
    const payload: EnrollDeviceRequestDto = {
      enrollmentToken: 'ps_et_nonexistent_token',
      agentInstanceId: randomUUID(),
      hostname: 'E2E-TERMINAL-02',
      os: 'Windows 11 Enterprise',
      appVersion: '0.1.0'
    };

    const response = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(400);
  });

  it('should return 400 Bad Request when request body violates validation schema', async () => {
    // Missing agentInstanceId, hostname, os, appVersion
    const invalidPayload = {
      enrollmentToken: 'ps_et_any'
    };

    const response = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as any;
    expect(body.message).toContain('Validation failed');
  });
});
