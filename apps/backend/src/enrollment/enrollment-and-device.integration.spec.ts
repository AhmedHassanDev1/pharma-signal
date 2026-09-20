import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EnrollmentModule } from './enrollment.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { EnrollmentTokenService } from './enrollment-token.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { DeviceAuthGuard } from '../auth/guards/device-auth.guard.js';
import { CurrentDevice } from '../auth/decorators/current-device.decorator.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus
} from '@prisma/client';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import { EnrollDeviceRequestDto } from '@pharma-signal/contracts';

@Controller('agent-api')
@UseGuards(DeviceAuthGuard)
class AgentProtectedController {
  @Get('ping')
  ping(@CurrentDevice() device: DeviceWithRelations) {
    return {
      status: 'ok',
      deviceId: device.id,
      organizationId: device.organizationId,
      branchId: device.branchId,
      deviceStatus: device.status
    };
  }
}

describe('AHM-293: Enrollment & Device Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let enrollmentTokenService: EnrollmentTokenService;
  let devicesService: DevicesService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AuthModule, EnrollmentModule],
      controllers: [AgentProtectedController]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');

    prisma = app.get<PrismaService>(PrismaService);
    enrollmentTokenService = app.get<EnrollmentTokenService>(EnrollmentTokenService);
    devicesService = app.get<DevicesService>(DevicesService);

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

  it('should verify the full lifecycle: successful enrollment, protected access, duplicate rejection, suspended/retired rejection, and cross-tenant hijacking prevention', async () => {
    // =========================================================================
    // 1. Setup Tenant & Branch Hierarchy
    // =========================================================================
    const org1 = await prisma.organization.create({
      data: {
        name: 'Alpha Medical Center',
        role: OrganizationRole.HOSPITAL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch1 = await prisma.branch.create({
      data: {
        organizationId: org1.id,
        name: 'Inpatient Pharmacy Alpha',
        code: 'AMC-INP-1',
        status: BranchStatus.ACTIVE
      }
    });

    const agentInstanceId1 = '11111111-2222-3333-4444-555555555555';

    // =========================================================================
    // 2. Token Creation & Device Enrollment (POST /api/v1/agent/enroll)
    // =========================================================================
    const token1 = await enrollmentTokenService.createToken({
      organizationId: org1.id,
      branchId: branch1.id,
      expiresInSeconds: 3600
    });

    const enrollPayload1: EnrollDeviceRequestDto = {
      enrollmentToken: token1.rawToken,
      agentInstanceId: agentInstanceId1,
      hostname: 'HOSPITAL-TERMINAL-01',
      os: 'Windows 11 Enterprise',
      appVersion: '1.0.0'
    };

    const enrollRes1 = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrollPayload1)
    });

    expect(enrollRes1.status).toBe(201);
    const enrollData1 = (await enrollRes1.json()) as any;
    expect(enrollData1.deviceId).toBeDefined();
    expect(enrollData1.organizationId).toBe(org1.id);
    expect(enrollData1.branchId).toBe(branch1.id);
    expect(enrollData1.deviceToken).toBeDefined();
    expect(enrollData1.status).toBe(DeviceStatus.ACTIVE);

    const deviceId1 = enrollData1.deviceId;
    const deviceToken1 = enrollData1.deviceToken;

    // =========================================================================
    // 3. Protected Endpoint Authentication with Bearer deviceToken
    // =========================================================================
    const pingRes1 = await fetch(`${baseUrl}/agent-api/ping`, {
      headers: { Authorization: `Bearer ${deviceToken1}` }
    });
    expect(pingRes1.status).toBe(200);
    const pingData1 = (await pingRes1.json()) as any;
    expect(pingData1.deviceId).toBe(deviceId1);
    expect(pingData1.organizationId).toBe(org1.id);
    expect(pingData1.branchId).toBe(branch1.id);
    expect(pingData1.deviceStatus).toBe(DeviceStatus.ACTIVE);

    // =========================================================================
    // 4. Duplicate Enrollment Prevention (Single-Use Token)
    // =========================================================================
    const duplicateRes = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrollPayload1)
    });
    expect(duplicateRes.status).toBe(400);

    // =========================================================================
    // 5. Invalid / Expired / Revoked Tokens Rejection
    // =========================================================================
    // 5a. Non-existent token
    const nonExistentRes = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...enrollPayload1,
        enrollmentToken: 'ps_et_does_not_exist'
      })
    });
    expect(nonExistentRes.status).toBe(400);

    // 5b. Revoked token
    const tokenToRevoke = await enrollmentTokenService.createToken({
      organizationId: org1.id,
      branchId: branch1.id,
      expiresInSeconds: 3600
    });
    await enrollmentTokenService.revokeToken(tokenToRevoke.token.id);

    const revokedRes = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...enrollPayload1,
        enrollmentToken: tokenToRevoke.rawToken
      })
    });
    expect(revokedRes.status).toBe(400);

    // 5c. Expired token
    const tokenToExpire = await enrollmentTokenService.createToken({
      organizationId: org1.id,
      branchId: branch1.id,
      expiresInSeconds: 3600
    });
    await prisma.enrollmentToken.update({
      where: { id: tokenToExpire.token.id },
      data: { expiresAt: new Date(Date.now() - 10000) }
    });

    const expiredRes = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...enrollPayload1,
        enrollmentToken: tokenToExpire.rawToken
      })
    });
    expect(expiredRes.status).toBe(400);

    // =========================================================================
    // 6. Suspended Device Operational Rejection
    // =========================================================================
    await devicesService.transitionStatus(deviceId1, DeviceStatus.SUSPENDED);

    const suspendedPingRes = await fetch(`${baseUrl}/agent-api/ping`, {
      headers: { Authorization: `Bearer ${deviceToken1}` }
    });
    expect(suspendedPingRes.status).toBe(401);

    // Re-activate
    await devicesService.transitionStatus(deviceId1, DeviceStatus.ACTIVE);
    const reactivatedPingRes = await fetch(`${baseUrl}/agent-api/ping`, {
      headers: { Authorization: `Bearer ${deviceToken1}` }
    });
    expect(reactivatedPingRes.status).toBe(200);

    // =========================================================================
    // 7. Retired Device Operational Rejection & Terminal Re-enrollment Rejection
    // =========================================================================
    await devicesService.transitionStatus(deviceId1, DeviceStatus.RETIRED);

    const retiredPingRes = await fetch(`${baseUrl}/agent-api/ping`, {
      headers: { Authorization: `Bearer ${deviceToken1}` }
    });
    expect(retiredPingRes.status).toBe(401);

    // Re-enrolling with the same agentInstanceId when RETIRED must be rejected
    const freshTokenForRetired = await enrollmentTokenService.createToken({
      organizationId: org1.id,
      branchId: branch1.id,
      expiresInSeconds: 3600
    });
    const reEnrollRetiredRes = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollmentToken: freshTokenForRetired.rawToken,
        agentInstanceId: agentInstanceId1,
        hostname: 'HOSPITAL-TERMINAL-01-RETRY',
        os: 'Windows 11 Enterprise',
        appVersion: '1.0.0'
      })
    });
    expect(reEnrollRetiredRes.status).toBe(400);

    // =========================================================================
    // 8. Cross-Tenant Hijacking Prevention
    // =========================================================================
    // Setup second organization & branch
    const org2 = await prisma.organization.create({
      data: {
        name: 'Beta Pharmacy Group',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch2 = await prisma.branch.create({
      data: {
        organizationId: org2.id,
        name: 'Beta Branch 1',
        code: 'BET-01',
        status: BranchStatus.ACTIVE
      }
    });

    // Create a new active device in Org 2
    const agentInstanceId2 = '22222222-3333-4444-5555-666666666666';
    const tokenOrg2 = await enrollmentTokenService.createToken({
      organizationId: org2.id,
      branchId: branch2.id,
      expiresInSeconds: 3600
    });

    const enrollOrg2Res = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollmentToken: tokenOrg2.rawToken,
        agentInstanceId: agentInstanceId2,
        hostname: 'BETA-POS-01',
        os: 'Windows 11 Pro',
        appVersion: '1.0.0'
      })
    });
    expect(enrollOrg2Res.status).toBe(201);

    // Now Org 1 attempts to enroll using Org 2's agentInstanceId2 -> 409 Conflict
    const tokenOrg1Hijack = await enrollmentTokenService.createToken({
      organizationId: org1.id,
      branchId: branch1.id,
      expiresInSeconds: 3600
    });

    const hijackRes = await fetch(`${baseUrl}/agent/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enrollmentToken: tokenOrg1Hijack.rawToken,
        agentInstanceId: agentInstanceId2, // Belongs to Org 2!
        hostname: 'SPOOFED-POS',
        os: 'Windows 11 Pro',
        appVersion: '1.0.0'
      })
    });
    expect(hijackRes.status).toBe(409);

    // =========================================================================
    // Cleanup
    // =========================================================================
    await prisma.organization.delete({ where: { id: org1.id } });
    await prisma.organization.delete({ where: { id: org2.id } });
  });
});
