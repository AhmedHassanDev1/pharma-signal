import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { DataSource, DetectionStatus } from '@prisma/client';

export interface CreateDataSourceInput {
  organizationId: string;
  branchId: string;
  deviceId: string;
  localDataSourceKey: string;
  engine: string;
  databaseName: string;
  declaredSoftwareName?: string | null;
  detectedSoftwareName?: string | null;
  detectionStatus: DetectionStatus;
  status?: string;
}

export interface UpdateDataSourceInput {
  engine?: string;
  databaseName?: string;
  declaredSoftwareName?: string | null;
  detectedSoftwareName?: string | null;
  detectionStatus?: DetectionStatus;
  status?: string;
}

@Injectable()
export class DataSourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<DataSource | null> {
    return this.prisma.dataSource.findUnique({
      where: { id }
    });
  }

  async findByDeviceAndLocalKey(
    deviceId: string,
    localDataSourceKey: string
  ): Promise<DataSource | null> {
    return this.prisma.dataSource.findFirst({
      where: {
        deviceId,
        localDataSourceKey
      }
    });
  }

  async create(data: CreateDataSourceInput): Promise<DataSource> {
    return this.prisma.dataSource.create({
      data: {
        organizationId: data.organizationId,
        branchId: data.branchId,
        deviceId: data.deviceId,
        localDataSourceKey: data.localDataSourceKey,
        engine: data.engine,
        databaseName: data.databaseName,
        declaredSoftwareName: data.declaredSoftwareName ?? null,
        detectedSoftwareName: data.detectedSoftwareName ?? null,
        detectionStatus: data.detectionStatus,
        status: data.status ?? 'ACTIVE'
      }
    });
  }

  async update(id: string, data: UpdateDataSourceInput): Promise<DataSource> {
    return this.prisma.dataSource.update({
      where: { id },
      data
    });
  }

  async findByBranch(branchId: string): Promise<DataSource[]> {
    return this.prisma.dataSource.findMany({
      where: { branchId }
    });
  }

  async findByOrganization(organizationId: string): Promise<DataSource[]> {
    return this.prisma.dataSource.findMany({
      where: { organizationId }
    });
  }

  async findByDevice(deviceId: string): Promise<DataSource[]> {
    return this.prisma.dataSource.findMany({
      where: { deviceId }
    });
  }
}
