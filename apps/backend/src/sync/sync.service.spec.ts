import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { InvalidProvenanceException } from '../common/exceptions/invalid-provenance.exception.js';
import { SyncBatchesRepository } from './sync-batches.repository.js';
import { CanonicalRecordsRepository } from './canonical-records.repository.js';
import { DataSourcesRepository } from '../data-sources/data-sources.repository.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import {
  DataSource,
  DeviceStatus,
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DetectionStatus,
  SyncBatchStatus
} from '@prisma/client';
import {
  CanonicalSyncRequestDto,
  SyncBatchStatus as ContractSyncBatchStatus
} from '@pharma-signal/contracts';

describe('SyncService', () => {
  let service: SyncService;
  let syncBatchesRepositoryMock: {
    create: ReturnType<typeof jest.fn>;
    findByDataSourceAndBatchId: ReturnType<typeof jest.fn>;
    update: ReturnType<typeof jest.fn>;
    findLatestByDataSource: ReturnType<typeof jest.fn>;
  };
  let canonicalRecordsRepositoryMock: {
    upsertProduct: ReturnType<typeof jest.fn>;
    upsertBatch: ReturnType<typeof jest.fn>;
    upsertInventory: ReturnType<typeof jest.fn>;
    upsertSupplier: ReturnType<typeof jest.fn>;
  };
  let dataSourcesRepositoryMock: {
    findById: ReturnType<typeof jest.fn<(id: string) => Promise<DataSource | null>>>;
  };

  const mockDevice: DeviceWithRelations = {
    id: 'device-1111',
    organizationId: 'org-1111',
    branchId: 'branch-1111',
    agentInstanceId: 'agent-1111',
    hostname: 'POS-TEST',
    os: 'Windows 11',
    appVersion: '0.1.0',
    status: DeviceStatus.ACTIVE,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: {
      id: 'org-1111',
      name: 'Test Org',
      role: OrganizationRole.RETAIL_PHARMACY,
      status: OrganizationStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    branch: {
      id: 'branch-1111',
      organizationId: 'org-1111',
      name: 'Main Branch',
      code: 'MAIN',
      status: BranchStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  const mockDataSource: DataSource = {
    id: 'ds-1111',
    organizationId: 'org-1111',
    branchId: 'branch-1111',
    deviceId: 'device-1111',
    localDataSourceKey: 'sqlite-pos-db',
    engine: 'SQLite',
    databaseName: 'pos.db',
    declaredSoftwareName: 'eStock',
    detectedSoftwareName: 'eStock',
    detectionStatus: DetectionStatus.MATCH,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const validProvenance = {
    tenantId: 'org-1111',
    deviceId: 'device-1111',
    dataSourceId: 'ds-1111',
    sourceTable: 'items',
    sourceId: 'item-1',
    extractedAt: '2026-09-20T12:00:00.000Z'
  };

  beforeEach(async () => {
    syncBatchesRepositoryMock = {
      create: jest.fn<any>(),
      findByDataSourceAndBatchId: jest.fn<any>(),
      update: jest.fn<any>(),
      findLatestByDataSource: jest.fn<any>()
    };

    canonicalRecordsRepositoryMock = {
      upsertProduct: jest.fn<any>(),
      upsertBatch: jest.fn<any>(),
      upsertInventory: jest.fn<any>(),
      upsertSupplier: jest.fn<any>()
    };

    dataSourcesRepositoryMock = {
      findById: jest.fn<any>()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: SyncBatchesRepository, useValue: syncBatchesRepositoryMock },
        { provide: CanonicalRecordsRepository, useValue: canonicalRecordsRepositoryMock },
        { provide: DataSourcesRepository, useValue: dataSourcesRepositoryMock }
      ]
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  describe('processSync', () => {
    const validDto: CanonicalSyncRequestDto = {
      dataSourceId: 'ds-1111',
      syncBatchId: 'batch-1111',
      products: [
        {
          sourceId: 'item-1',
          sourceTable: 'items',
          data: { code: 'P1', name: 'Product 1', isActive: true },
          provenance: validProvenance
        }
      ]
    };

    it('should throw BadRequestException if X-Sync-Batch-ID header does not match body syncBatchId', async () => {
      await expect(
        service.processSync(mockDevice, validDto, 'mismatched-batch-id')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if data source not found', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(null);

      await expect(service.processSync(mockDevice, validDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if data source belongs to another device', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue({
        ...mockDataSource,
        deviceId: 'other-device'
      });

      await expect(service.processSync(mockDevice, validDto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should return cached summary if batch was already processed (idempotency)', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      const cachedSummary = {
        syncBatchId: 'batch-1111',
        status: ContractSyncBatchStatus.COMPLETED,
        receivedCounts: { products: 1, batches: 0, inventories: 0, suppliers: 0, totalRecords: 1 },
        appliedCounts: { products: 1, batches: 0, inventories: 0, suppliers: 0, totalRecords: 1 },
        rejectedCounts: 0,
        message: 'Sync batch processed successfully'
      };

      syncBatchesRepositoryMock.findByDataSourceAndBatchId.mockResolvedValue({
        id: 'existing-batch-id',
        status: SyncBatchStatus.COMPLETED,
        summary: cachedSummary
      });

      const result = await service.processSync(mockDevice, validDto);
      expect(result).toEqual(cachedSummary);
      expect(canonicalRecordsRepositoryMock.upsertProduct).not.toHaveBeenCalled();
    });

    it('should process sync payload and upsert records when valid', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      syncBatchesRepositoryMock.findByDataSourceAndBatchId.mockResolvedValue(null);
      syncBatchesRepositoryMock.create.mockResolvedValue({ id: 'new-batch-uuid' });
      syncBatchesRepositoryMock.update.mockResolvedValue({ id: 'new-batch-uuid' });

      const result = await service.processSync(mockDevice, validDto, 'batch-1111');

      expect(result.status).toBe(ContractSyncBatchStatus.COMPLETED);
      expect(result.appliedCounts.products).toBe(1);
      expect(result.rejectedCounts).toBe(0);
      expect(canonicalRecordsRepositoryMock.upsertProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'org-1111',
          dataSourceId: 'ds-1111',
          code: 'P1',
          name: 'Product 1'
        })
      );
      expect(syncBatchesRepositoryMock.update).toHaveBeenCalledWith(
        'new-batch-uuid',
        expect.objectContaining({
          status: SyncBatchStatus.COMPLETED
        })
      );
    });

    it('should reject request with InvalidProvenanceException if provenance does not match authenticated device/org', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      syncBatchesRepositoryMock.findByDataSourceAndBatchId.mockResolvedValue(null);

      const invalidProvenanceDto: CanonicalSyncRequestDto = {
        dataSourceId: 'ds-1111',
        syncBatchId: 'batch-1111',
        products: [
          {
            sourceId: 'item-1',
            sourceTable: 'items',
            data: { code: 'P1', name: 'Product 1' },
            provenance: {
              ...validProvenance,
              tenantId: 'forged-tenant'
            }
          }
        ]
      };

      await expect(service.processSync(mockDevice, invalidProvenanceDto)).rejects.toThrow(
        InvalidProvenanceException
      );
      expect(canonicalRecordsRepositoryMock.upsertProduct).not.toHaveBeenCalled();
    });

    it('should allow retrying a previously failed batch with the same syncBatchId', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      const failedBatch = {
        id: 'failed-batch-uuid',
        syncBatchId: 'batch-1111',
        status: SyncBatchStatus.FAILED,
        summary: null
      };

      syncBatchesRepositoryMock.findByDataSourceAndBatchId.mockResolvedValue(failedBatch);
      syncBatchesRepositoryMock.update.mockResolvedValue({ id: 'failed-batch-uuid' });

      const result = await service.processSync(mockDevice, validDto, 'batch-1111');

      expect(result.status).toBe(ContractSyncBatchStatus.COMPLETED);
      expect(result.appliedCounts.products).toBe(1);
      expect(syncBatchesRepositoryMock.update).toHaveBeenCalledWith(
        'failed-batch-uuid',
        expect.objectContaining({ status: SyncBatchStatus.PROCESSING })
      );
      expect(canonicalRecordsRepositoryMock.upsertProduct).toHaveBeenCalled();
    });

    it('should handle concurrent requests gracefully via finding existing batch if create throws', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      syncBatchesRepositoryMock.findByDataSourceAndBatchId
        .mockResolvedValueOnce(null) // first check
        .mockResolvedValueOnce({
          id: 'concurrent-batch-uuid',
          summary: {
            syncBatchId: 'batch-1111',
            status: ContractSyncBatchStatus.COMPLETED,
            receivedCounts: { products: 1, batches: 0, inventories: 0, suppliers: 0, totalRecords: 1 },
            appliedCounts: { products: 1, batches: 0, inventories: 0, suppliers: 0, totalRecords: 1 },
            rejectedCounts: 0
          }
        }); // second check after error

      syncBatchesRepositoryMock.create.mockRejectedValue(new Error('Unique constraint violation'));

      const result = await service.processSync(mockDevice, validDto, 'batch-1111');
      expect(result.status).toBe(ContractSyncBatchStatus.COMPLETED);
    });
  });

  describe('getBatchBySyncBatchId', () => {
    it('should return batch if found and device owns data source', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      const mockBatch = { id: 'batch-1' };
      syncBatchesRepositoryMock.findByDataSourceAndBatchId.mockResolvedValue(mockBatch);

      const result = await service.getBatchBySyncBatchId(mockDevice, 'ds-1111', 'batch-1');
      expect(result).toEqual(mockBatch);
    });

    it('should throw ForbiddenException if data source belongs to another device', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue({
        ...mockDataSource,
        deviceId: 'other-device'
      });

      await expect(
        service.getBatchBySyncBatchId(mockDevice, 'ds-1111', 'batch-1')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if batch not found', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      syncBatchesRepositoryMock.findByDataSourceAndBatchId.mockResolvedValue(null);

      await expect(
        service.getBatchBySyncBatchId(mockDevice, 'ds-1111', 'missing-batch')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
