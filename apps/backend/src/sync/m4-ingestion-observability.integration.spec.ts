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
import {
  CanonicalSyncRequestDto,
  SyncBatchStatus as ContractSyncBatchStatus
} from '@pharma-signal/contracts';

describe('M4 Ingestion Observability & Diagnostics Integration API', () => {
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

  it('should provide full observability, diagnostics, and batch tracking for data sources', async () => {
    // 1. Setup Tenant, Branch, Device 1, Device 2, and DataSource
    const org = await prisma.organization.create({
      data: {
        name: 'Observability Test Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Observability Branch',
        code: `OBS-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device1 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'OBS-POS-1',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });

    const device1Token = deviceCredentialService.generateDeviceToken({
      sub: device1.id,
      deviceId: device1.id,
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId: device1.agentInstanceId
    });

    const device2 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'OBS-POS-2',
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

    const dataSource = await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device1.id,
        localDataSourceKey: 'obs-pos-sqlite',
        engine: 'SQLite',
        databaseName: 'obs_pos.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    // 2. Query initial diagnostics before any sync batch
    const initialDiagRes = await fetch(
      `${baseUrl}/agent/data-sources/${dataSource.id}/sync/diagnostics`,
      {
        headers: { Authorization: `Bearer ${device1Token}` }
      }
    );
    expect(initialDiagRes.status).toBe(200);
    const initialDiag = await initialDiagRes.json();
    expect(initialDiag.dataSourceId).toBe(dataSource.id);
    expect(initialDiag.totalBatches).toBe(0);
    expect(initialDiag.canonicalCounts).toEqual({
      products: 0,
      batches: 0,
      inventories: 0,
      suppliers: 0
    });
    expect(initialDiag.latestBatch).toBeNull();
    expect(initialDiag.lastSuccessAt).toBeNull();

    // 3. Execute Batch 1: Ingest records
    const batch1Id = randomUUID();
    const timeT1 = new Date('2026-09-20T10:00:00Z').toISOString();

    const batch1Payload: CanonicalSyncRequestDto = {
      dataSourceId: dataSource.id,
      syncBatchId: batch1Id,
      products: [
        {
          sourceId: 'p-1',
          sourceTable: 'products',
          data: {
            sourceId: 'p-1',
            sourceTable: 'products',
            code: 'PAN-500',
            name: 'Panadol Extra',
            category: 'Analgesics',
            unit: 'Box',
            isActive: true
          },
          provenance: {
            tenantId: org.id,
            deviceId: device1.id,
            dataSourceId: dataSource.id,
            sourceTable: 'products',
            sourceId: 'p-1',
            extractedAt: timeT1
          }
        }
      ],
      batches: [
        {
          sourceId: 'b-1',
          sourceTable: 'batches',
          data: {
            sourceId: 'b-1',
            sourceTable: 'batches',
            productSourceId: 'p-1',
            batchNumber: 'PAN-2026-A',
            expiryDate: '2028-12-31'
          },
          provenance: {
            tenantId: org.id,
            deviceId: device1.id,
            dataSourceId: dataSource.id,
            sourceTable: 'batches',
            sourceId: 'b-1',
            extractedAt: timeT1
          }
        }
      ],
      inventories: [
        {
          sourceId: 'i-1',
          sourceTable: 'inventory',
          data: {
            sourceId: 'i-1',
            sourceTable: 'inventory',
            productSourceId: 'p-1',
            batchSourceId: 'b-1',
            quantity: 50,
            unitPrice: 25.0
          },
          provenance: {
            tenantId: org.id,
            deviceId: device1.id,
            dataSourceId: dataSource.id,
            sourceTable: 'inventory',
            sourceId: 'i-1',
            extractedAt: timeT1
          }
        }
      ],
      suppliers: [
        {
          sourceId: 's-1',
          sourceTable: 'suppliers',
          data: {
            sourceId: 's-1',
            sourceTable: 'suppliers',
            name: 'GlaxoSmithKline Egypt',
            isActive: true
          },
          provenance: {
            tenantId: org.id,
            deviceId: device1.id,
            dataSourceId: dataSource.id,
            sourceTable: 'suppliers',
            sourceId: 's-1',
            extractedAt: timeT1
          }
        }
      ]
    };

    const sync1Res = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`,
        'X-Sync-Batch-ID': batch1Id
      },
      body: JSON.stringify(batch1Payload)
    });
    expect(sync1Res.status).toBe(200);
    const sync1Body = await sync1Res.json();
    expect(sync1Body.status).toBe(ContractSyncBatchStatus.COMPLETED);
    expect(sync1Body.appliedCounts.totalRecords).toBe(4);

    // 4. Query diagnostics after Batch 1
    const postSync1DiagRes = await fetch(
      `${baseUrl}/agent/data-sources/${dataSource.id}/sync/diagnostics`,
      {
        headers: { Authorization: `Bearer ${device1Token}` }
      }
    );
    expect(postSync1DiagRes.status).toBe(200);
    const postSync1Diag = await postSync1DiagRes.json();
    expect(postSync1Diag.totalBatches).toBe(1);
    expect(postSync1Diag.batchesByStatus.COMPLETED).toBe(1);
    expect(postSync1Diag.canonicalCounts).toEqual({
      products: 1,
      batches: 1,
      inventories: 1,
      suppliers: 1
    });
    expect(postSync1Diag.latestBatch.syncBatchId).toBe(batch1Id);
    expect(postSync1Diag.lastSuccessAt).not.toBeNull();

    // 5. Query batch list endpoint
    const batchesListRes = await fetch(
      `${baseUrl}/agent/data-sources/${dataSource.id}/sync/batches?limit=10`,
      {
        headers: { Authorization: `Bearer ${device1Token}` }
      }
    );
    expect(batchesListRes.status).toBe(200);
    const batchesList = await batchesListRes.json();
    expect(Array.isArray(batchesList)).toBe(true);
    expect(batchesList.length).toBe(1);
    expect(batchesList[0].syncBatchId).toBe(batch1Id);

    // 6. Security Check: Device 2 cannot access diagnostics or batches of Device 1's data source
    const device2DiagRes = await fetch(
      `${baseUrl}/agent/data-sources/${dataSource.id}/sync/diagnostics`,
      {
        headers: { Authorization: `Bearer ${device2Token}` }
      }
    );
    expect(device2DiagRes.status).toBe(403);

    const device2BatchesRes = await fetch(
      `${baseUrl}/agent/data-sources/${dataSource.id}/sync/batches`,
      {
        headers: { Authorization: `Bearer ${device2Token}` }
      }
    );
    expect(device2BatchesRes.status).toBe(403);

    // 7. Non-existent data source check
    const nonExistentRes = await fetch(
      `${baseUrl}/agent/data-sources/${randomUUID()}/sync/diagnostics`,
      {
        headers: { Authorization: `Bearer ${device1Token}` }
      }
    );
    expect(nonExistentRes.status).toBe(404);

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
