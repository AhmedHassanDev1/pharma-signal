import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  CanonicalProduct,
  CanonicalBatch,
  CanonicalInventory,
  CanonicalSupplier,
  Prisma
} from '@prisma/client';
import { RecordProvenance } from '@pharma-signal/contracts';

export interface UpsertProductInput {
  tenantId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  isActive?: boolean;
  rawPayload?: Record<string, unknown> | null;
  provenance: RecordProvenance;
  extractedAt: Date;
}

export interface UpsertBatchInput {
  tenantId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  productSourceId: string;
  productId?: string | null;
  batchNumber: string;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  rawPayload?: Record<string, unknown> | null;
  provenance: RecordProvenance;
  extractedAt: Date;
}

export interface UpsertInventoryInput {
  tenantId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  productSourceId: string;
  productId?: string | null;
  batchSourceId?: string | null;
  batchId?: string | null;
  quantity: number;
  unitPrice?: number | null;
  location?: string | null;
  rawPayload?: Record<string, unknown> | null;
  provenance: RecordProvenance;
  extractedAt: Date;
}

export interface UpsertSupplierInput {
  tenantId: string;
  dataSourceId: string;
  sourceTable: string;
  sourceId: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive?: boolean;
  rawPayload?: Record<string, unknown> | null;
  provenance: RecordProvenance;
  extractedAt: Date;
}

export interface UpsertResult<T> {
  record: T;
  isStale: boolean;
  isCreated: boolean;
}

@Injectable()
export class CanonicalRecordsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts a CanonicalProduct using natural key (tenantId, dataSourceId, sourceTable, sourceId).
   * Enforces extractedAt conflict rule: rejects overwriting with older/stale extractedAt.
   */
  async upsertProduct(input: UpsertProductInput): Promise<CanonicalProduct> {
    const where = {
      tenantId_dataSourceId_sourceTable_sourceId: {
        tenantId: input.tenantId,
        dataSourceId: input.dataSourceId,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId
      }
    };

    const existing = await this.prisma.canonicalProduct.findUnique({ where });

    if (!existing) {
      return this.prisma.canonicalProduct.create({
        data: {
          tenantId: input.tenantId,
          dataSourceId: input.dataSourceId,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
          code: input.code,
          name: input.name,
          description: input.description,
          category: input.category,
          unit: input.unit,
          isActive: input.isActive ?? true,
          rawPayload: (input.rawPayload as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          provenance: input.provenance as unknown as Prisma.InputJsonValue,
          extractedAt: input.extractedAt
        }
      });
    }

    // Timestamp conflict resolution: If incoming extractedAt is older than existing, skip update
    if (input.extractedAt < existing.extractedAt) {
      return existing;
    }

    return this.prisma.canonicalProduct.update({
      where,
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        category: input.category,
        unit: input.unit,
        isActive: input.isActive ?? true,
        rawPayload: (input.rawPayload as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        provenance: input.provenance as unknown as Prisma.InputJsonValue,
        extractedAt: input.extractedAt
      }
    });
  }

  /**
   * Upserts a CanonicalBatch using natural key (tenantId, dataSourceId, sourceTable, sourceId).
   * Resolves productId relation if not explicitly passed.
   * Enforces extractedAt conflict rule: rejects overwriting with older/stale extractedAt.
   */
  async upsertBatch(input: UpsertBatchInput): Promise<CanonicalBatch> {
    const where = {
      tenantId_dataSourceId_sourceTable_sourceId: {
        tenantId: input.tenantId,
        dataSourceId: input.dataSourceId,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId
      }
    };

    // If productId is not provided, try to resolve from CanonicalProduct by productSourceId
    let resolvedProductId = input.productId;
    if (!resolvedProductId && input.productSourceId) {
      const matchedProduct = await this.prisma.canonicalProduct.findFirst({
        where: {
          tenantId: input.tenantId,
          dataSourceId: input.dataSourceId,
          sourceId: input.productSourceId
        },
        select: { id: true }
      });
      resolvedProductId = matchedProduct?.id ?? null;
    }

    const existing = await this.prisma.canonicalBatch.findUnique({ where });

    if (!existing) {
      return this.prisma.canonicalBatch.create({
        data: {
          tenantId: input.tenantId,
          dataSourceId: input.dataSourceId,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
          productSourceId: input.productSourceId,
          productId: resolvedProductId,
          batchNumber: input.batchNumber,
          expiryDate: input.expiryDate,
          manufacturingDate: input.manufacturingDate,
          rawPayload: (input.rawPayload as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          provenance: input.provenance as unknown as Prisma.InputJsonValue,
          extractedAt: input.extractedAt
        }
      });
    }

    if (input.extractedAt < existing.extractedAt) {
      return existing;
    }

    return this.prisma.canonicalBatch.update({
      where,
      data: {
        productSourceId: input.productSourceId,
        productId: resolvedProductId ?? existing.productId,
        batchNumber: input.batchNumber,
        expiryDate: input.expiryDate,
        manufacturingDate: input.manufacturingDate,
        rawPayload: (input.rawPayload as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        provenance: input.provenance as unknown as Prisma.InputJsonValue,
        extractedAt: input.extractedAt
      }
    });
  }

  /**
   * Upserts a CanonicalInventory using natural key (tenantId, dataSourceId, sourceTable, sourceId).
   * Resolves productId and batchId relations if not explicitly passed.
   * Enforces extractedAt conflict rule: rejects overwriting with older/stale extractedAt.
   */
  async upsertInventory(input: UpsertInventoryInput): Promise<CanonicalInventory> {
    const where = {
      tenantId_dataSourceId_sourceTable_sourceId: {
        tenantId: input.tenantId,
        dataSourceId: input.dataSourceId,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId
      }
    };

    let resolvedProductId = input.productId;
    if (!resolvedProductId && input.productSourceId) {
      const matchedProduct = await this.prisma.canonicalProduct.findFirst({
        where: {
          tenantId: input.tenantId,
          dataSourceId: input.dataSourceId,
          sourceId: input.productSourceId
        },
        select: { id: true }
      });
      resolvedProductId = matchedProduct?.id ?? null;
    }

    let resolvedBatchId = input.batchId;
    if (!resolvedBatchId && input.batchSourceId) {
      const matchedBatch = await this.prisma.canonicalBatch.findFirst({
        where: {
          tenantId: input.tenantId,
          dataSourceId: input.dataSourceId,
          sourceId: input.batchSourceId
        },
        select: { id: true }
      });
      resolvedBatchId = matchedBatch?.id ?? null;
    }

    const existing = await this.prisma.canonicalInventory.findUnique({ where });

    if (!existing) {
      return this.prisma.canonicalInventory.create({
        data: {
          tenantId: input.tenantId,
          dataSourceId: input.dataSourceId,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
          productSourceId: input.productSourceId,
          productId: resolvedProductId,
          batchSourceId: input.batchSourceId,
          batchId: resolvedBatchId,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          location: input.location,
          rawPayload: (input.rawPayload as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          provenance: input.provenance as unknown as Prisma.InputJsonValue,
          extractedAt: input.extractedAt
        }
      });
    }

    if (input.extractedAt < existing.extractedAt) {
      return existing;
    }

    return this.prisma.canonicalInventory.update({
      where,
      data: {
        productSourceId: input.productSourceId,
        productId: resolvedProductId ?? existing.productId,
        batchSourceId: input.batchSourceId,
        batchId: resolvedBatchId ?? existing.batchId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        location: input.location,
        rawPayload: (input.rawPayload as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        provenance: input.provenance as unknown as Prisma.InputJsonValue,
        extractedAt: input.extractedAt
      }
    });
  }

  /**
   * Upserts a CanonicalSupplier using natural key (tenantId, dataSourceId, sourceTable, sourceId).
   * Enforces extractedAt conflict rule: rejects overwriting with older/stale extractedAt.
   */
  async upsertSupplier(input: UpsertSupplierInput): Promise<CanonicalSupplier> {
    const where = {
      tenantId_dataSourceId_sourceTable_sourceId: {
        tenantId: input.tenantId,
        dataSourceId: input.dataSourceId,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId
      }
    };

    const existing = await this.prisma.canonicalSupplier.findUnique({ where });

    if (!existing) {
      return this.prisma.canonicalSupplier.create({
        data: {
          tenantId: input.tenantId,
          dataSourceId: input.dataSourceId,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
          name: input.name,
          contact: input.contact,
          phone: input.phone,
          email: input.email,
          address: input.address,
          isActive: input.isActive ?? true,
          rawPayload: (input.rawPayload as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          provenance: input.provenance as unknown as Prisma.InputJsonValue,
          extractedAt: input.extractedAt
        }
      });
    }

    if (input.extractedAt < existing.extractedAt) {
      return existing;
    }

    return this.prisma.canonicalSupplier.update({
      where,
      data: {
        name: input.name,
        contact: input.contact,
        phone: input.phone,
        email: input.email,
        address: input.address,
        isActive: input.isActive ?? true,
        rawPayload: (input.rawPayload as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        provenance: input.provenance as unknown as Prisma.InputJsonValue,
        extractedAt: input.extractedAt
      }
    });
  }

  async findProductByNaturalKey(
    tenantId: string,
    dataSourceId: string,
    sourceTable: string,
    sourceId: string
  ): Promise<CanonicalProduct | null> {
    return this.prisma.canonicalProduct.findUnique({
      where: {
        tenantId_dataSourceId_sourceTable_sourceId: {
          tenantId,
          dataSourceId,
          sourceTable,
          sourceId
        }
      }
    });
  }

  async findBatchByNaturalKey(
    tenantId: string,
    dataSourceId: string,
    sourceTable: string,
    sourceId: string
  ): Promise<CanonicalBatch | null> {
    return this.prisma.canonicalBatch.findUnique({
      where: {
        tenantId_dataSourceId_sourceTable_sourceId: {
          tenantId,
          dataSourceId,
          sourceTable,
          sourceId
        }
      }
    });
  }

  async countByDataSource(dataSourceId: string): Promise<{
    products: number;
    batches: number;
    inventories: number;
    suppliers: number;
  }> {
    const [products, batches, inventories, suppliers] = await Promise.all([
      this.prisma.canonicalProduct.count({ where: { dataSourceId } }),
      this.prisma.canonicalBatch.count({ where: { dataSourceId } }),
      this.prisma.canonicalInventory.count({ where: { dataSourceId } }),
      this.prisma.canonicalSupplier.count({ where: { dataSourceId } })
    ]);
    return { products, batches, inventories, suppliers };
  }
}
