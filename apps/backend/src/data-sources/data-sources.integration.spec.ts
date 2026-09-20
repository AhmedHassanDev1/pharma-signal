import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { DeviceCredentialService } from '../enrollment/device-credential.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus,
  DetectionStatus
} from '@prisma/client';
import { RegisterDataSourceRequestDto } from '@pharma-signal/contracts';

describe('Data Sources Integration & Registration API (POST /api/v1/agent/data-sources)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deviceCredentialService: DeviceCredentialService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    prisma = app.get<PrismaService>(PrismaService);
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

  it('should authenticate via device token and register a new data source with server-derived ownership', async () => {
    // 1. Setup Organization, Branch, and Device in PostgreSQL
    const org = await prisma.organization.create({
      data: {
        name: 'Data Source Test Org',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Data Source Test Branch',
        code: `DS-TEST-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const agentInstanceId = randomUUID();
    const device = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId,
        hostname: 'DS-TEST-PC',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });

    // 2. Generate valid device JWT token
    const tokenPayload = {
      sub: device.id,
      deviceId: device.id,
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId: device.agentInstanceId
    };
    const deviceToken = deviceCredentialService.generateDeviceToken(tokenPayload);

    // 3. Test unauthenticated request (must return 401)
    const unauthResponse = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localDataSourceKey: 'sqlite-pos-db',
        engine: 'SQLite',
        databaseName: 'pharmacy.db'
      })
    });
    expect(unauthResponse.status).toBe(401);

    // 4. Test valid authenticated registration
    const payload: RegisterDataSourceRequestDto = {
      localDataSourceKey: 'sqlite-pos-db',
      engine: 'SQLite',
      databaseName: 'pharmacy.db',
      declaredSoftwareName: 'eStock',
      detectedSoftwareName: 'eStock'
    };

    const response = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify(payload)
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as any;

    expect(body.dataSourceId).toBeDefined();
    expect(body.organizationId).toBe(org.id);
    expect(body.branchId).toBe(branch.id);
    expect(body.deviceId).toBe(device.id);
    expect(body.localDataSourceKey).toBe('sqlite-pos-db');
    expect(body.declaredSoftwareName).toBe('eStock');
    expect(body.detectedSoftwareName).toBe('eStock');
    expect(body.detectionStatus).toBe('MATCH');
    expect(body.status).toBe('ACTIVE');
    expect(body.tenantId).toBe(org.id);

    // 5. Verify record in PostgreSQL database
    const dbRecord = await prisma.dataSource.findUnique({
      where: { id: body.dataSourceId }
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.organizationId).toBe(org.id);
    expect(dbRecord?.branchId).toBe(branch.id);
    expect(dbRecord?.deviceId).toBe(device.id);
    expect(dbRecord?.detectionStatus).toBe(DetectionStatus.MATCH);

    // 6. Test idempotency: same device + same local key -> same DataSource
    const updatePayload: RegisterDataSourceRequestDto = {
      localDataSourceKey: 'sqlite-pos-db',
      engine: 'SQLite',
      databaseName: 'pharmacy_v2.db',
      declaredSoftwareName: 'eStock',
      detectedSoftwareName: 'SofTech'
    };

    const updateResponse = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify(updatePayload)
    });

    expect(updateResponse.status).toBe(201);
    const updateBody = (await updateResponse.json()) as any;
    expect(updateBody.dataSourceId).toBe(body.dataSourceId); // Must be the same DataSource
    expect(updateBody.detectionStatus).toBe('CONFLICT');

    const updatedDbRecord = await prisma.dataSource.findUnique({
      where: { id: body.dataSourceId }
    });
    expect(updatedDbRecord?.databaseName).toBe('pharmacy_v2.db');
    expect(updatedDbRecord?.detectionStatus).toBe(DetectionStatus.CONFLICT);

    // 7. Test: different device + same local key -> different DataSource
    const device2 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'DS-TEST-PC-2',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });
    const device2Token = deviceCredentialService.generateDeviceToken({
      sub: device2.id,
      deviceId: device2.id,
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId: device2.agentInstanceId
    });

    const responseDevice2 = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device2Token}`
      },
      body: JSON.stringify({
        localDataSourceKey: 'sqlite-pos-db', // Same localDataSourceKey!
        engine: 'SQLite',
        databaseName: 'pharmacy_device2.db'
      })
    });

    expect(responseDevice2.status).toBe(201);
    const bodyDevice2 = (await responseDevice2.json()) as any;
    expect(bodyDevice2.dataSourceId).toBeDefined();
    expect(bodyDevice2.dataSourceId).not.toBe(body.dataSourceId); // Must be different DataSource
    expect(bodyDevice2.deviceId).toBe(device2.id);

    // 8. Test Security: client cannot spoof { organization_id, branch_id, device_id } to change ownership
    const spoofedResponse1 = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify({
        localDataSourceKey: 'sqlite-pos-db-3',
        engine: 'SQLite',
        databaseName: 'test.db',
        organization_id: randomUUID(),
        branch_id: randomUUID(),
        device_id: randomUUID()
      })
    });
    expect(spoofedResponse1.status).toBe(400);

    const spoofedResponse2 = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify({
        localDataSourceKey: 'sqlite-pos-db-4',
        engine: 'SQLite',
        databaseName: 'test.db',
        organizationId: randomUUID(),
        branchId: randomUUID(),
        deviceId: randomUUID()
      })
    });
    expect(spoofedResponse2.status).toBe(400);

    // 9. Test validation error (missing required fields)
    const invalidResponse = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify({
        localDataSourceKey: 'sqlite-pos-db'
      })
    });
    expect(invalidResponse.status).toBe(400);

    // Cleanup: Cascade delete from organization cleans up branches, devices, dataSources
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
