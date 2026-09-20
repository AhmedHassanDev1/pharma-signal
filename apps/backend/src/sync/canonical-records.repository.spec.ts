import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CanonicalRecordsRepository,
  UpsertProductInput,
  UpsertBatchInput,
  UpsertInventoryInput,
  UpsertSupplierInput
} from './canonical-records.repository.js';
import { PrismaService } from '../database/prisma.service.js';

describe('CanonicalRecordsRepository', () => {
  let repository: CanonicalRecordsRepository;
  let prismaMock: {
    canonicalProduct: {
      create: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      findFirst: ReturnType<typeof jest.fn>;
    };
    canonicalBatch: {
      create: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      findFirst: ReturnType<typeof jest.fn>;
    };
    canonicalInventory: {
      create: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
    };
    canonicalSupplier: {
      create: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
    };
  };

  const sampleProvenance = {
    tenantId: 'org-1',
    deviceId: 'dev-1',
    dataSourceId: 'ds-1',
    sourceTable: 'items',
    sourceId: 'item-100',
    extractedAt: '2026-09-20T12:00:00.000Z'
  };

  beforeEach(async () => {
    prismaMock = {
      canonicalProduct: {
        create: jest.fn<any>(),
        update: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        findFirst: jest.fn<any>()
      },
      canonicalBatch: {
        create: jest.fn<any>(),
        update: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        findFirst: jest.fn<any>()
      },
      canonicalInventory: {
        create: jest.fn<any>(),
        update: jest.fn<any>(),
        findUnique: jest.fn<any>()
      },
      canonicalSupplier: {
        create: jest.fn<any>(),
        update: jest.fn<any>(),
        findUnique: jest.fn<any>()
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalRecordsRepository,
        { provide: PrismaService, useValue: prismaMock }
      ]
    }).compile();

    repository = module.get<CanonicalRecordsRepository>(CanonicalRecordsRepository);
  });

  describe('upsertProduct', () => {
    const input: UpsertProductInput = {
      tenantId: 'org-1',
      dataSourceId: 'ds-1',
      sourceTable: 'items',
      sourceId: 'item-100',
      code: 'PAN-500',
      name: 'Panadol 500mg',
      provenance: sampleProvenance,
      extractedAt: new Date('2026-09-20T12:00:00.000Z')
    };

    it('should create CanonicalProduct if not existing', async () => {
      const mockResult = { id: 'prod-uuid-1', code: 'PAN-500', name: 'Panadol 500mg' };
      prismaMock.canonicalProduct.findUnique.mockResolvedValue(null);
      prismaMock.canonicalProduct.create.mockResolvedValue(mockResult);

      const result = await repository.upsertProduct(input);
      expect(result).toEqual(mockResult);
      expect(prismaMock.canonicalProduct.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'PAN-500',
          name: 'Panadol 500mg'
        })
      });
    });

    it('should update CanonicalProduct if existing and incoming extractedAt is newer or equal', async () => {
      const existing = {
        id: 'prod-uuid-1',
        code: 'PAN-OLD',
        name: 'Panadol Old',
        extractedAt: new Date('2026-09-20T11:00:00.000Z')
      };
      const updated = { id: 'prod-uuid-1', code: 'PAN-500', name: 'Panadol 500mg' };

      prismaMock.canonicalProduct.findUnique.mockResolvedValue(existing);
      prismaMock.canonicalProduct.update.mockResolvedValue(updated);

      const result = await repository.upsertProduct(input);
      expect(result).toEqual(updated);
      expect(prismaMock.canonicalProduct.update).toHaveBeenCalledWith({
        where: expect.any(Object),
        data: expect.objectContaining({ code: 'PAN-500', name: 'Panadol 500mg' })
      });
    });

    it('should skip update and return existing record if incoming extractedAt is older (stale update)', async () => {
      const existing = {
        id: 'prod-uuid-1',
        code: 'PAN-NEWEST',
        name: 'Panadol Newest',
        extractedAt: new Date('2026-09-20T15:00:00.000Z') // newer than input (12:00)
      };

      prismaMock.canonicalProduct.findUnique.mockResolvedValue(existing);

      const result = await repository.upsertProduct(input);
      expect(result).toEqual(existing);
      expect(prismaMock.canonicalProduct.update).not.toHaveBeenCalled();
    });
  });

  describe('upsertBatch', () => {
    const input: UpsertBatchInput = {
      tenantId: 'org-1',
      dataSourceId: 'ds-1',
      sourceTable: 'batches',
      sourceId: 'batch-200',
      productSourceId: 'item-100',
      batchNumber: 'B12345',
      provenance: sampleProvenance,
      extractedAt: new Date('2026-09-20T12:00:00.000Z')
    };

    it('should resolve product relation and create CanonicalBatch', async () => {
      const mockResult = { id: 'batch-uuid-1', batchNumber: 'B12345', productId: 'prod-uuid-1' };
      prismaMock.canonicalProduct.findFirst.mockResolvedValue({ id: 'prod-uuid-1' });
      prismaMock.canonicalBatch.findUnique.mockResolvedValue(null);
      prismaMock.canonicalBatch.create.mockResolvedValue(mockResult);

      const result = await repository.upsertBatch(input);
      expect(result).toEqual(mockResult);
      expect(prismaMock.canonicalBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          batchNumber: 'B12345',
          productId: 'prod-uuid-1'
        })
      });
    });
  });

  describe('upsertInventory', () => {
    const input: UpsertInventoryInput = {
      tenantId: 'org-1',
      dataSourceId: 'ds-1',
      sourceTable: 'inventory',
      sourceId: 'inv-300',
      productSourceId: 'item-100',
      batchSourceId: 'batch-200',
      quantity: 50,
      provenance: sampleProvenance,
      extractedAt: new Date('2026-09-20T12:00:00.000Z')
    };

    it('should resolve product and batch relations and create CanonicalInventory', async () => {
      const mockResult = { id: 'inv-uuid-1', quantity: 50 };
      prismaMock.canonicalProduct.findFirst.mockResolvedValue({ id: 'prod-uuid-1' });
      prismaMock.canonicalBatch.findFirst.mockResolvedValue({ id: 'batch-uuid-1' });
      prismaMock.canonicalInventory.findUnique.mockResolvedValue(null);
      prismaMock.canonicalInventory.create.mockResolvedValue(mockResult);

      const result = await repository.upsertInventory(input);
      expect(result).toEqual(mockResult);
      expect(prismaMock.canonicalInventory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quantity: 50,
          productId: 'prod-uuid-1',
          batchId: 'batch-uuid-1'
        })
      });
    });
  });

  describe('upsertSupplier', () => {
    const input: UpsertSupplierInput = {
      tenantId: 'org-1',
      dataSourceId: 'ds-1',
      sourceTable: 'suppliers',
      sourceId: 'sup-400',
      name: 'Pharma Dist Co',
      provenance: sampleProvenance,
      extractedAt: new Date('2026-09-20T12:00:00.000Z')
    };

    it('should create CanonicalSupplier when not existing', async () => {
      const mockResult = { id: 'sup-uuid-1', name: 'Pharma Dist Co' };
      prismaMock.canonicalSupplier.findUnique.mockResolvedValue(null);
      prismaMock.canonicalSupplier.create.mockResolvedValue(mockResult);

      const result = await repository.upsertSupplier(input);
      expect(result).toEqual(mockResult);
      expect(prismaMock.canonicalSupplier.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Pharma Dist Co' })
      });
    });
  });
});
