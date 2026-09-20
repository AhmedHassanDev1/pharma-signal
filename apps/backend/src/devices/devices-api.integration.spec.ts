import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus,
  DetectionStatus
} from '@prisma/client';
import { DeviceListItemDto } from '@pharma-signal/contracts';

describe('Devices API (GET /api/v1/devices)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    prisma = app.get<PrismaService>(PrismaService);

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

  it('should list devices with tenant context and data sources count', async () => {
    // 1. Setup Org, Branch, Device, DataSource
    const org = await prisma.organization.create({
      data: {
        name: 'Devices Test Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Main Dispensary',
        code: `DEV-B-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'POS-TERMINAL-99',
        os: 'Windows 11 Pro',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });

    await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device.id,
        localDataSourceKey: 'pos-db',
        engine: 'SQLite',
        databaseName: 'pos.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    // 2. Query GET /api/v1/devices
    const res = await fetch(`${baseUrl}/devices`);
    expect(res.status).toBe(200);

    const devices: DeviceListItemDto[] = await res.json();
    expect(Array.isArray(devices)).toBe(true);

    const found = devices.find((d) => d.id === device.id);
    expect(found).toBeDefined();
    expect(found?.hostname).toBe('POS-TERMINAL-99');
    expect(found?.organizationName).toBe('Devices Test Pharmacy');
    expect(found?.branchName).toBe('Main Dispensary');
    expect(found?.status).toBe(DeviceStatus.ACTIVE);
    expect(found?.dataSourcesCount).toBe(1);

    // 3. Query GET /api/v1/devices/:id
    const singleRes = await fetch(`${baseUrl}/devices/${device.id}`);
    expect(singleRes.status).toBe(200);
    const singleDevice = await singleRes.json();
    expect(singleDevice.id).toBe(device.id);
    expect(singleDevice.organization.name).toBe('Devices Test Pharmacy');

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
