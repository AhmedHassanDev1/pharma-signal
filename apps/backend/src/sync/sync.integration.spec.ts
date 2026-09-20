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
  DetectionStatus,
  SyncBatchStatus
} from '@prisma/client';
import {
  CanonicalSyncRequestDto,
  SyncBatchStatus as ContractSyncBatchStatus
} from '@pharma-signal/contracts';

describe('Canonical Sync Endpoint Integration API (POST /api/v1/agent/sync)', () => {
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

  it('should authenticate device, validate X-Sync-Batch-ID, ingest canonical records, update ingestion_batches, and handle idempotency', async () => {
    // 1. Setup Tenant, Branch, Device, DataSource
    const org = await prisma.organization.create({
      data: {
        name: 'Sync Endpoint Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Sync Endpoint Branch',
        code: `SYNC-EP-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device1 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'SYNC-POS-1',
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

    const dataSource1 = await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device1.id,
        localDataSourceKey: 'sqlite-pos-sync',
        engine: 'SQLite',
        databaseName: 'sync_pos.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    const syncBatchId1 = randomUUID();
    const extractedAt = new Date().toISOString();

    const payload: CanonicalSyncRequestDto = {
      dataSourceId: dataSource1.id,
      syncBatchId: syncBatchId1,
      products: [
        {
          sourceId: 'prod-001',
          sourceTable: 'products',
          data: {
            sourceId: 'prod-001',
            sourceTable: 'products',
            code: 'AMOX-500',
            name: 'Amoxicillin 500mg',
            category: 'Antibiotics',
            unit: 'Capsules',
            isActive: true
          },
          provenance: {
            tenantId: org.id,
            deviceId: device1.id,
            dataSourceId: dataSource1.id,
            sourceTable: 'products',
            sourceId: 'prod-001',
            extractedAt
          }
        }
      ],
      batches: [
        {
          sourceId: 'batch-001',
          sourceTable: 'batches',
          data: {
            sourceId: 'batch-001',
            sourceTable: 'batches',
            productSourceId: 'prod-001',
            batchNumber: 'AMX-2026-001',
            expiryDate: '2028-06-30'
          },
          provenance: {
            tenantId: org.id,
            deviceId: device1.id,
            dataSourceId: dataSource1.id,
            sourceTable: 'batches',
            sourceId: 'batch-001',
            extractedAt
          }
        }
      ],
      inventories: [
        {
          sourceId: 'inv-001',
          sourceTable: 'inventory',
          data: {
            sourceId: 'inv-001',
            sourceTable: 'inventory',
            productSourceId: 'prod-001',
            batchSourceId: 'batch-001',
            quantity: 120,
            unitPrice: 15.5
          },
          provenance: {
            tenantId: org.id,
            deviceId: device1.id,
            dataSourceId: dataSource1.id,
            sourceTable: 'inventory',
            sourceId: 'inv-001',
            extractedAt
          }
        }
      ],
      suppliers: [
        {
          sourceId: 'sup-001',
          sourceTable: 'suppliers',
          data: {
            sourceId: 'sup-001',
            sourceTable: 'suppliers',
            name: 'MedPharma Distribution',
            phone: '01000000000',
            isActive: true
          },
          provenance: {
            tenantId: org.id,
            deviceId: device1.id,
            dataSourceId: dataSource1.id,
            sourceTable: 'suppliers',
            sourceId: 'sup-001',
            extractedAt
          }
        }
      ]
    };

    // 2. Test unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    expect(unauthRes.status).toBe(401);

    // 3. Test mismatched X-Sync-Batch-ID header -> 400
    const mismatchHeaderRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`,
        'X-Sync-Batch-ID': randomUUID() // different from payload.syncBatchId
      },
      body: JSON.stringify(payload)
    });
    expect(mismatchHeaderRes.status).toBe(400);

    // 4. Test Cross-Device access -> 403
    const device2 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'SYNC-POS-2',
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

    const crossDeviceRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device2Token}`,
        'X-Sync-Batch-ID': syncBatchId1
      },
      body: JSON.stringify(payload)
    });
    expect(crossDeviceRes.status).toBe(403);

    // 5. Test Successful Sync with X-Sync-Batch-ID
    const successRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`,
        'X-Sync-Batch-ID': syncBatchId1
      },
      body: JSON.stringify(payload)
    });

    expect(successRes.status).toBe(200);
    const body = await successRes.json();
    expect(body.syncBatchId).toBe(syncBatchId1);
    expect(body.status).toBe(ContractSyncBatchStatus.COMPLETED);
    expect(body.receivedCounts.totalRecords).toBe(4);
    expect(body.appliedCounts.totalRecords).toBe(4);
    expect(body.rejectedCounts).toBe(0);

    // Verify canonical records in DB
    const dbProduct = await prisma.canonicalProduct.findUnique({
      where: {
        tenantId_dataSourceId_sourceTable_sourceId: {
          tenantId: org.id,
          dataSourceId: dataSource1.id,
          sourceTable: 'products',
          sourceId: 'prod-001'
        }
      }
    });
    expect(dbProduct).not.toBeNull();
    expect(dbProduct?.name).toBe('Amoxicillin 500mg');

    const dbBatch = await prisma.canonicalBatch.findUnique({
      where: {
        tenantId_dataSourceId_sourceTable_sourceId: {
          tenantId: org.id,
          dataSourceId: dataSource1.id,
          sourceTable: 'batches',
          sourceId: 'batch-001'
        }
      }
    });
    expect(dbBatch).not.toBeNull();
    expect(dbBatch?.batchNumber).toBe('AMX-2026-001');

    // 6. Test Idempotency: Re-submitting the exact same sync batch returns cached summary
    const duplicateRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`,
        'X-Sync-Batch-ID': syncBatchId1
      },
      body: JSON.stringify(payload)
    });

    expect(duplicateRes.status).toBe(200);
    const duplicateBody = await duplicateRes.json();
    expect(duplicateBody).toEqual(body);

    // Verify product count did not duplicate
    const totalProducts = await prisma.canonicalProduct.count({
      where: { dataSourceId: dataSource1.id }
    });
    expect(totalProducts).toBe(1);

    // 7. Test GET /api/v1/agent/sync/batches/:syncBatchId?dataSourceId=...
    const getBatchRes = await fetch(
      `${baseUrl}/agent/sync/batches/${syncBatchId1}?dataSourceId=${dataSource1.id}`,
      {
        headers: { Authorization: `Bearer ${device1Token}` }
      }
    );
    expect(getBatchRes.status).toBe(200);
    const retrievedBatch = await getBatchRes.json();
    expect(retrievedBatch.syncBatchId).toBe(syncBatchId1);
    expect(retrievedBatch.status).toBe(SyncBatchStatus.COMPLETED);

    // Cleanup: Cascade delete on org
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
