import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { AuthModule } from './auth.module.js';
import { EnrollmentModule } from '../enrollment/enrollment.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { DeviceCredentialService } from '../enrollment/device-credential.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { DeviceAuthGuard } from './guards/device-auth.guard.js';
import { CurrentDevice } from './decorators/current-device.decorator.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus
} from '@prisma/client';
import { DeviceWithRelations } from '../devices/devices.repository.js';

@Controller('test-device-auth')
@UseGuards(DeviceAuthGuard)
class TestProtectedController {
  @Get('me')
  getDevice(@CurrentDevice() device: DeviceWithRelations) {
    return {
      deviceId: device.id,
      organizationId: device.organizationId,
      branchId: device.branchId,
      hostname: device.hostname,
      status: device.status,
      organizationName: device.organization.name,
      branchName: device.branch.name
    };
  }
}

describe('Device Authentication & Authorization Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deviceCredentialService: DeviceCredentialService;
  let devicesService: DevicesService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AuthModule, EnrollmentModule],
      controllers: [TestProtectedController]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    prisma = app.get<PrismaService>(PrismaService);
    deviceCredentialService = app.get<DeviceCredentialService>(DeviceCredentialService);
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

  it('should authenticate active device and reject suspended, retired, or invalid tokens', async () => {
    // 1. Setup Organization & Branch in PostgreSQL
    const org = await prisma.organization.create({
      data: {
        name: 'Protected Dev Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Protected Branch 1',
        code: `PROT-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const agentInstanceId = randomUUID();

    // 2. Create Device
    const device = await devicesService.registerDevice({
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId,
      hostname: 'SECURE-POS-01',
      os: 'Windows 11 Enterprise',
      appVersion: '0.1.0'
    });

    // 3. Issue valid device token
    const validToken = deviceCredentialService.generateDeviceToken({
      sub: device.id,
      deviceId: device.id,
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId
    });

    // 4. Access protected route with valid Bearer token -> 200 OK
    const res1 = await fetch(`${baseUrl}/test-device-auth/me`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as any;
    expect(body1.deviceId).toBe(device.id);
    expect(body1.organizationId).toBe(org.id);
    expect(body1.branchId).toBe(branch.id);
    expect(body1.status).toBe(DeviceStatus.ACTIVE);
    expect(body1.organizationName).toBe('Protected Dev Pharmacy');
    expect(body1.branchName).toBe('Protected Branch 1');

    // 5. Suspend device: ACTIVE -> SUSPENDED
    await devicesService.transitionStatus(device.id, DeviceStatus.SUSPENDED);

    // Access with same token must now be rejected (401 Unauthorized)
    const res2 = await fetch(`${baseUrl}/test-device-auth/me`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    expect(res2.status).toBe(401);

    // 6. Retire device: SUSPENDED -> RETIRED
    await devicesService.transitionStatus(device.id, DeviceStatus.RETIRED);

    // Access with same token must be rejected (401 Unauthorized)
    const res3 = await fetch(`${baseUrl}/test-device-auth/me`, {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    expect(res3.status).toBe(401);

    // 7. Request without token -> 401 Unauthorized
    const res4 = await fetch(`${baseUrl}/test-device-auth/me`);
    expect(res4.status).toBe(401);

    // 8. Request with forged token -> 401 Unauthorized
    const res5 = await fetch(`${baseUrl}/test-device-auth/me`, {
      headers: { Authorization: 'Bearer forged.token.value' }
    });
    expect(res5.status).toBe(401);

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
