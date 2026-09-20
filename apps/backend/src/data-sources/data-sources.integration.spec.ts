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
        code: 'DS-TEST-BR-1',
        status: BranchStatus.ACTIVE
      }
    });

    const agentInstanceId = 'da1a0000-1111-2222-3333-444444444444';
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

    if (response.status !== 201) {
      console.error('Registration failed:', await response.text());
    }

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

    // 6. Test idempotency: re-register with updated databaseName
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
    expect(updateBody.dataSourceId).toBe(body.dataSourceId); // Same dataSourceId
    expect(updateBody.detectionStatus).toBe('CONFLICT');

    const updatedDbRecord = await prisma.dataSource.findUnique({
      where: { id: body.dataSourceId }
    });
    expect(updatedDbRecord?.databaseName).toBe('pharmacy_v2.db');
    expect(updatedDbRecord?.detectionStatus).toBe(DetectionStatus.CONFLICT);

    // 7. Test spoofed branchId (client passes a branchId different from authenticated device branch)
    const spoofedResponse = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify({
        ...payload,
        branchId: '00000000-0000-0000-0000-000000000000'
      })
    });
    expect(spoofedResponse.status).toBe(400);

    // 8. Test validation error (missing required fields)
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
