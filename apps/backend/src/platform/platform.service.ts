import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { DeviceStatus } from '@prisma/client';
import { CURRENT_API_VERSION } from '@pharma-signal/config';
import {
  PlatformOverviewDto,
  RecentSyncBatchItemDto,
  RecentDeviceItemDto
} from '@pharma-signal/contracts';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<PlatformOverviewDto> {
    const isDbHealthy = await this.prisma.isHealthy();

    const [
      activeDevices,
      totalDevices,
      totalDataSources,
      totalSyncBatches,
      productCount,
      batchCount,
      inventoryCount,
      supplierCount,
      totalOrganizations,
      totalBranches,
      recentBatchesRaw,
      recentDevicesRaw
    ] = await Promise.all([
      this.prisma.device.count({ where: { status: DeviceStatus.ACTIVE } }),
      this.prisma.device.count(),
      this.prisma.dataSource.count(),
      this.prisma.ingestionBatch.count(),
      this.prisma.canonicalProduct.count(),
      this.prisma.canonicalBatch.count(),
      this.prisma.canonicalInventory.count(),
      this.prisma.canonicalSupplier.count(),
      this.prisma.organization.count(),
      this.prisma.branch.count(),
      this.prisma.ingestionBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      this.prisma.device.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const totalCanonicalRecords =
      productCount + batchCount + inventoryCount + supplierCount;

    const recentBatches: RecentSyncBatchItemDto[] = recentBatchesRaw.map((b) => {
      const received = (b.receivedCounts as Record<string, unknown>) ?? {};
      const applied = (b.appliedCounts as Record<string, unknown>) ?? {};
      return {
        id: b.id,
        syncBatchId: b.syncBatchId,
        dataSourceId: b.dataSourceId,
        status: b.status,
        receivedTotal: typeof received.totalRecords === 'number' ? received.totalRecords : 0,
        appliedTotal: typeof applied.totalRecords === 'number' ? applied.totalRecords : 0,
        rejectedTotal: b.rejectedCounts ?? 0,
        processedAt: b.processedAt ? b.processedAt.toISOString() : null,
        createdAt: b.createdAt.toISOString()
      };
    });

    const recentDevices: RecentDeviceItemDto[] = recentDevicesRaw.map((d) => ({
      id: d.id,
      hostname: d.hostname,
      os: d.os,
      status: d.status,
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      createdAt: d.createdAt.toISOString()
    }));

    return {
      health: {
        status: isDbHealthy ? 'ok' : 'degraded',
        database: isDbHealthy ? 'up' : 'down',
        api: 'up',
        uptime: process.uptime(),
        version: CURRENT_API_VERSION,
        timestamp: new Date().toISOString()
      },
      metrics: {
        activeDevices,
        totalDevices,
        totalDataSources,
        totalSyncBatches,
        totalCanonicalRecords,
        totalOrganizations,
        totalBranches
      },
      recentBatches,
      recentDevices
    };
  }
}
