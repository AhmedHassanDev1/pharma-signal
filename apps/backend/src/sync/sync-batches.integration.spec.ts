import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { SyncBatchesRepository } from './sync-batches.repository.js';
import { CanonicalRecordsRepository } from './canonical-records.repository.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus,
  DetectionStatus,
  SyncBatchStatus
} from '@prisma/client';

describe('Sync & Ingestion Batch Persistence Integration (AHM-299)', () => {
  let prisma: PrismaService;
  let syncBatchesRepository: SyncBatchesRepository;
  let canonicalRecordsRepository: CanonicalRecordsRepository;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    syncBatchesRepository = moduleRef.get<SyncBatchesRepository>(SyncBatchesRepository);
    canonicalRecordsRepository = moduleRef.get<CanonicalRecordsRepository>(CanonicalRecordsRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should persist ingestion batches, enforce uniqueness per (dataSourceId, syncBatchId), update summary, and support canonical upserts', async () => {
    // 1. Setup Org, Branch, Device, DataSource
    const org = await prisma.organization.create({
      data: {
        name: 'Sync Persistence Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Sync Branch',
        code: `SYNC-BR-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'SYNC-POS',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });

    const dataSource = await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device.id,
        localDataSourceKey: 'sqlite-sync-db',
        engine: 'SQLite',
        databaseName: 'sync_test.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    // 2. Create IngestionBatch
    const syncBatchId = `batch-${randomUUID()}`;
    const initialBatch = await syncBatchesRepository.create({
      syncBatchId,
      dataSourceId: dataSource.id,
      deviceId: device.id,
      tenantId: org.id,
      status: SyncBatchStatus.PENDING,
      receivedCounts: { products: 2, batches: 1, inventories: 1, suppliers: 0, totalRecords: 4 }
    });

    expect(initialBatch.id).toBeDefined();
    expect(initialBatch.status).toBe(SyncBatchStatus.PENDING);
    expect(initialBatch.syncBatchId).toBe(syncBatchId);

    // 3. Verify Unique Constraint on (dataSourceId, syncBatchId)
    await expect(
      syncBatchesRepository.create({
        syncBatchId,
        dataSourceId: dataSource.id,
        deviceId: device.id,
        tenantId: org.id
      })
    ).rejects.toThrow();

    // 4. Update Batch status to COMPLETED with appliedCounts and cached summary
    const summary = {
      syncBatchId,
      status: 'COMPLETED',
      appliedCounts: { products: 2, batches: 1, inventories: 1, suppliers: 0, totalRecords: 4 }
    };

    const updatedBatch = await syncBatchesRepository.update(initialBatch.id, {
      status: SyncBatchStatus.COMPLETED,
      appliedCounts: { products: 2, batches: 1, inventories: 1, suppliers: 0, totalRecords: 4 },
      rejectedCounts: 0,
      summary,
      processedAt: new Date()
    });

    expect(updatedBatch.status).toBe(SyncBatchStatus.COMPLETED);
    expect(updatedBatch.summary).toEqual(summary);
    expect(updatedBatch.processedAt).not.toBeNull();

    // 5. Test Canonical Upserts with natural key
    const provenance = {
      tenantId: org.id,
      deviceId: device.id,
      dataSourceId: dataSource.id,
      sourceTable: 'tbl_items',
      sourceId: 'item-001',
      extractedAt: new Date().toISOString()
    };

    // First upsert (insert)
    const product1 = await canonicalRecordsRepository.upsertProduct({
      tenantId: org.id,
      dataSourceId: dataSource.id,
      sourceTable: 'tbl_items',
      sourceId: 'item-001',
      code: 'PAN-EXTRA',
      name: 'Panadol Extra',
      provenance,
      extractedAt: new Date()
    });
    expect(product1.id).toBeDefined();
    expect(product1.name).toBe('Panadol Extra');

    // Second upsert (update) - modifies name without erroring or duplicating
    const product1Updated = await canonicalRecordsRepository.upsertProduct({
      tenantId: org.id,
      dataSourceId: dataSource.id,
      sourceTable: 'tbl_items',
      sourceId: 'item-001',
      code: 'PAN-EXTRA',
      name: 'Panadol Extra 500mg/65mg',
      provenance,
      extractedAt: new Date()
    });
    expect(product1Updated.id).toBe(product1.id);
    expect(product1Updated.name).toBe('Panadol Extra 500mg/65mg');

    // Verify only 1 product exists in DB
    const productCount = await prisma.canonicalProduct.count({
      where: {
        tenantId: org.id,
        dataSourceId: dataSource.id,
        sourceTable: 'tbl_items',
        sourceId: 'item-001'
      }
    });
    expect(productCount).toBe(1);

    // Cleanup: Cascade delete on org
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
