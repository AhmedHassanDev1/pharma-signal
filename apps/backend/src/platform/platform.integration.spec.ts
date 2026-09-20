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
   DetectionStatus,
   SyncBatchStatus
 } from '@prisma/client';
 import { PlatformOverviewDto } from '@pharma-signal/contracts';

describe('Platform Overview API (GET /api/v1/platform/overview)', () => {
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

  it('should return platform overview with health, metrics, recent batches, and recent devices', async () => {
    // 1. Setup test data: Org, Branch, Device, DataSource, Batch, Canonical Product
    const org = await prisma.organization.create({
      data: {
        name: 'Platform Overview Test Org',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Platform Branch',
        code: `PLT-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'PLATFORM-POS-01',
        os: 'Windows 11 Pro',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });

    const dataSource = await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device.id,
        localDataSourceKey: 'plt-db-key',
        engine: 'SQLite',
        databaseName: 'platform_test.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    const batch = await prisma.ingestionBatch.create({
      data: {
        syncBatchId: randomUUID(),
        dataSourceId: dataSource.id,
        deviceId: device.id,
        tenantId: org.id,
        status: SyncBatchStatus.COMPLETED,
        receivedCounts: { totalRecords: 10, products: 10 },
        appliedCounts: { totalRecords: 10, products: 10 },
        rejectedCounts: 0
      }
    });

    await prisma.canonicalProduct.create({
      data: {
        tenantId: org.id,
        dataSourceId: dataSource.id,
        sourceTable: 'products',
        sourceId: 'plt-prod-1',
        code: 'PAR-500',
        name: 'Paracetamol 500mg',
        provenance: {
          tenantId: org.id,
          deviceId: device.id,
          dataSourceId: dataSource.id,
          sourceTable: 'products',
          sourceId: 'plt-prod-1',
          extractedAt: new Date().toISOString()
        },
        extractedAt: new Date()
      }
    });

    // 2. Query GET /api/v1/platform/overview
    const res = await fetch(`${baseUrl}/platform/overview`);
    expect(res.status).toBe(200);

    const data: PlatformOverviewDto = await res.json();

    // Verify Health
    expect(data.health.status).toBe('ok');
    expect(data.health.database).toBe('up');
    expect(data.health.api).toBe('up');
    expect(typeof data.health.uptime).toBe('number');
    expect(typeof data.health.version).toBe('string');
    expect(typeof data.health.timestamp).toBe('string');

    // Verify Metrics
    expect(data.metrics.activeDevices).toBeGreaterThanOrEqual(1);
    expect(data.metrics.totalDevices).toBeGreaterThanOrEqual(1);
    expect(data.metrics.totalDataSources).toBeGreaterThanOrEqual(1);
    expect(data.metrics.totalSyncBatches).toBeGreaterThanOrEqual(1);
    expect(data.metrics.totalCanonicalRecords).toBeGreaterThanOrEqual(1);
    expect(data.metrics.totalOrganizations).toBeGreaterThanOrEqual(1);
    expect(data.metrics.totalBranches).toBeGreaterThanOrEqual(1);

    // Verify Recent Batches
    expect(Array.isArray(data.recentBatches)).toBe(true);
    const foundBatch = data.recentBatches.find((b) => b.id === batch.id);
    expect(foundBatch).toBeDefined();
    expect(foundBatch?.status).toBe(SyncBatchStatus.COMPLETED);
    expect(foundBatch?.receivedTotal).toBe(10);
    expect(foundBatch?.appliedTotal).toBe(10);

    // Verify Recent Devices
    expect(Array.isArray(data.recentDevices)).toBe(true);
    const foundDevice = data.recentDevices.find((d) => d.id === device.id);
    expect(foundDevice).toBeDefined();
    expect(foundDevice?.hostname).toBe('PLATFORM-POS-01');

    // 3. Query GET /api/v1/dashboard/overview (alias)
    const aliasRes = await fetch(`${baseUrl}/dashboard/overview`);
    expect(aliasRes.status).toBe(200);
    const aliasData: PlatformOverviewDto = await aliasRes.json();
    expect(aliasData.health.status).toBe('ok');

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
