import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SyncBatchesRepository, CreateSyncBatchInput, UpdateSyncBatchInput } from './sync-batches.repository.js';
import { PrismaService } from '../database/prisma.service.js';
import { SyncBatchStatus, IngestionBatch } from '@prisma/client';

describe('SyncBatchesRepository', () => {
  let repository: SyncBatchesRepository;
  let prismaMock: {
    ingestionBatch: {
      create: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      findFirst: ReturnType<typeof jest.fn>;
      findMany: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
    };
  };

  const mockBatch: IngestionBatch = {
    id: 'batch-uuid-1',
    syncBatchId: 'batch-client-1',
    dataSourceId: 'ds-1',
    deviceId: 'dev-1',
    tenantId: 'org-1',
    status: SyncBatchStatus.PENDING,
    receivedCounts: { products: 10, batches: 5, inventories: 10, suppliers: 2, totalRecords: 27 },
    appliedCounts: { products: 0, batches: 0, inventories: 0, suppliers: 0, totalRecords: 0 },
    rejectedCounts: 0,
    summary: null,
    errorMessage: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    prismaMock = {
      ingestionBatch: {
        create: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        findFirst: jest.fn<any>(),
        findMany: jest.fn<any>(),
        update: jest.fn<any>()
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncBatchesRepository,
        { provide: PrismaService, useValue: prismaMock }
      ]
    }).compile();

    repository = module.get<SyncBatchesRepository>(SyncBatchesRepository);
  });

  describe('create', () => {
    it('should create an IngestionBatch with default status PENDING', async () => {
      prismaMock.ingestionBatch.create.mockResolvedValue(mockBatch);

      const input: CreateSyncBatchInput = {
        syncBatchId: 'batch-client-1',
        dataSourceId: 'ds-1',
        deviceId: 'dev-1',
        tenantId: 'org-1',
        receivedCounts: { products: 10, batches: 5, inventories: 10, suppliers: 2, totalRecords: 27 }
      };

      const result = await repository.create(input);
      expect(result).toEqual(mockBatch);
      expect(prismaMock.ingestionBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          syncBatchId: 'batch-client-1',
          dataSourceId: 'ds-1',
          deviceId: 'dev-1',
          tenantId: 'org-1',
          status: SyncBatchStatus.PENDING
        })
      });
    });
  });

  describe('findByDataSourceAndBatchId', () => {
    it('should find batch by composite key (dataSourceId, syncBatchId)', async () => {
      prismaMock.ingestionBatch.findUnique.mockResolvedValue(mockBatch);

      const result = await repository.findByDataSourceAndBatchId('ds-1', 'batch-client-1');
      expect(result).toEqual(mockBatch);
      expect(prismaMock.ingestionBatch.findUnique).toHaveBeenCalledWith({
        where: {
          dataSourceId_syncBatchId: {
            dataSourceId: 'ds-1',
            syncBatchId: 'batch-client-1'
          }
        }
      });
    });
  });

  describe('update', () => {
    it('should update status, counts, and summary', async () => {
      const updated = {
        ...mockBatch,
        status: SyncBatchStatus.COMPLETED,
        appliedCounts: { products: 10, batches: 5, inventories: 10, suppliers: 2, totalRecords: 27 },
        summary: { success: true }
      };
      prismaMock.ingestionBatch.update.mockResolvedValue(updated);

      const updateInput: UpdateSyncBatchInput = {
        status: SyncBatchStatus.COMPLETED,
        appliedCounts: { products: 10, batches: 5, inventories: 10, suppliers: 2, totalRecords: 27 },
        summary: { success: true }
      };

      const result = await repository.update('batch-uuid-1', updateInput);
      expect(result.status).toBe(SyncBatchStatus.COMPLETED);
      expect(prismaMock.ingestionBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-uuid-1' },
        data: expect.objectContaining({
          status: SyncBatchStatus.COMPLETED
        })
      });
    });
  });

  describe('findLatestByDataSource', () => {
    it('should query the most recently created batch for a data source', async () => {
      prismaMock.ingestionBatch.findFirst.mockResolvedValue(mockBatch);

      const result = await repository.findLatestByDataSource('ds-1');
      expect(result).toEqual(mockBatch);
      expect(prismaMock.ingestionBatch.findFirst).toHaveBeenCalledWith({
        where: { dataSourceId: 'ds-1' },
        orderBy: { createdAt: 'desc' }
      });
    });
  });
});
