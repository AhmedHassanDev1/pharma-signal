import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { IngestionBatch, SyncBatchStatus, Prisma } from '@prisma/client';
import { SyncBatchCounts } from '@pharma-signal/contracts';

export interface CreateSyncBatchInput {
  syncBatchId: string;
  dataSourceId: string;
  deviceId: string;
  tenantId: string;
  status?: SyncBatchStatus;
  receivedCounts?: SyncBatchCounts;
  appliedCounts?: SyncBatchCounts;
  rejectedCounts?: number;
  summary?: Record<string, unknown>;
  errorMessage?: string;
}

export interface UpdateSyncBatchInput {
  status?: SyncBatchStatus;
  receivedCounts?: SyncBatchCounts;
  appliedCounts?: SyncBatchCounts;
  rejectedCounts?: number;
  summary?: Record<string, unknown>;
  errorMessage?: string | null;
  processedAt?: Date | null;
}

@Injectable()
export class SyncBatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSyncBatchInput): Promise<IngestionBatch> {
    return this.prisma.ingestionBatch.create({
      data: {
        syncBatchId: input.syncBatchId,
        dataSourceId: input.dataSourceId,
        deviceId: input.deviceId,
        tenantId: input.tenantId,
        status: input.status ?? SyncBatchStatus.PENDING,
        receivedCounts: (input.receivedCounts as unknown as Prisma.InputJsonValue) ?? {},
        appliedCounts: (input.appliedCounts as unknown as Prisma.InputJsonValue) ?? {},
        rejectedCounts: input.rejectedCounts ?? 0,
        summary: (input.summary as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        errorMessage: input.errorMessage
      }
    });
  }

  async findByDataSourceAndBatchId(
    dataSourceId: string,
    syncBatchId: string
  ): Promise<IngestionBatch | null> {
    return this.prisma.ingestionBatch.findUnique({
      where: {
        dataSourceId_syncBatchId: {
          dataSourceId,
          syncBatchId
        }
      }
    });
  }

  async findById(id: string): Promise<IngestionBatch | null> {
    return this.prisma.ingestionBatch.findUnique({
      where: { id }
    });
  }

  async update(id: string, input: UpdateSyncBatchInput): Promise<IngestionBatch> {
    return this.prisma.ingestionBatch.update({
      where: { id },
      data: {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.receivedCounts !== undefined && {
          receivedCounts: input.receivedCounts as unknown as Prisma.InputJsonValue
        }),
        ...(input.appliedCounts !== undefined && {
          appliedCounts: input.appliedCounts as unknown as Prisma.InputJsonValue
        }),
        ...(input.rejectedCounts !== undefined && { rejectedCounts: input.rejectedCounts }),
        ...(input.summary !== undefined && {
          summary: input.summary as unknown as Prisma.InputJsonValue
        }),
        ...(input.errorMessage !== undefined && { errorMessage: input.errorMessage }),
        ...(input.processedAt !== undefined && { processedAt: input.processedAt })
      }
    });
  }

  async countByStatus(dataSourceId: string): Promise<Record<SyncBatchStatus, number>> {
    const grouped = await this.prisma.ingestionBatch.groupBy({
      by: ['status'],
      where: { dataSourceId },
      _count: { status: true }
    });
    const result: Record<SyncBatchStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      PARTIALLY_FAILED: 0
    };
    for (const item of grouped) {
      result[item.status] = item._count.status;
    }
    return result;
  }

  async findLatestSuccessful(dataSourceId: string): Promise<IngestionBatch | null> {
    return this.prisma.ingestionBatch.findFirst({
      where: {
        dataSourceId,
        status: SyncBatchStatus.COMPLETED
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findLatestByDataSource(dataSourceId: string): Promise<IngestionBatch | null> {
    return this.prisma.ingestionBatch.findFirst({
      where: { dataSourceId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByDataSource(dataSourceId: string, limit = 50): Promise<IngestionBatch[]> {
    return this.prisma.ingestionBatch.findMany({
      where: { dataSourceId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async findByTenant(tenantId: string, limit = 50): Promise<IngestionBatch[]> {
    return this.prisma.ingestionBatch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}
