import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  RegisterDataSourceRequestDto,
  RegisterDataSourceResponseDto,
  DetectionStatus as ContractDetectionStatus
} from '@pharma-signal/contracts';
import { DetectionStatus, DataSource } from '@prisma/client';
import { DataSourcesRepository } from './data-sources.repository.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';

@Injectable()
export class DataSourcesService {
  constructor(private readonly repository: DataSourcesRepository) {}

  /**
   * Registers a data source or idempotently updates an existing data source
   * for the authenticated device.
   * 
   * Server-side ownership rules:
   * 1. organizationId is derived strictly from device.organizationId.
   * 2. branchId is derived strictly from device.branchId.
   * 3. deviceId is derived strictly from device.id.
   * 4. If client provided a branchId, it must match device.branchId.
   */
  async registerDataSource(
    device: DeviceWithRelations,
    dto: RegisterDataSourceRequestDto
  ): Promise<RegisterDataSourceResponseDto> {
    if (dto.branchId && dto.branchId !== device.branchId) {
      throw new BadRequestException(
        `Provided branchId '${dto.branchId}' does not match authenticated device branch '${device.branchId}'`
      );
    }

    const detectionStatus = this.calculateDetectionStatus(
      dto.declaredSoftwareName,
      dto.detectedSoftwareName
    );

    const existing = await this.repository.findByDeviceAndLocalKey(
      device.id,
      dto.localDataSourceKey
    );

    let record: DataSource;

    if (existing) {
      record = await this.repository.update(existing.id, {
        engine: dto.engine,
        databaseName: dto.databaseName,
        declaredSoftwareName:
          dto.declaredSoftwareName !== undefined ? dto.declaredSoftwareName : existing.declaredSoftwareName,
        detectedSoftwareName:
          dto.detectedSoftwareName !== undefined ? dto.detectedSoftwareName : existing.detectedSoftwareName,
        detectionStatus,
        status: 'ACTIVE'
      });
    } else {
      record = await this.repository.create({
        organizationId: device.organizationId,
        branchId: device.branchId,
        deviceId: device.id,
        localDataSourceKey: dto.localDataSourceKey,
        engine: dto.engine,
        databaseName: dto.databaseName,
        declaredSoftwareName: dto.declaredSoftwareName ?? null,
        detectedSoftwareName: dto.detectedSoftwareName ?? null,
        detectionStatus,
        status: 'ACTIVE'
      });
    }

    return {
      dataSourceId: record.id,
      organizationId: record.organizationId,
      branchId: record.branchId,
      deviceId: record.deviceId,
      localDataSourceKey: record.localDataSourceKey,
      declaredSoftwareName: record.declaredSoftwareName,
      detectedSoftwareName: record.detectedSoftwareName,
      detectionStatus: record.detectionStatus as unknown as ContractDetectionStatus,
      status: record.status,
      tenantId: record.organizationId
    };
  }

  async getDataSourceById(id: string): Promise<DataSource> {
    const dataSource = await this.repository.findById(id);
    if (!dataSource) {
      throw new NotFoundException(`Data source with ID '${id}' not found`);
    }
    return dataSource;
  }

  calculateDetectionStatus(
    declared?: string | null,
    detected?: string | null
  ): DetectionStatus {
    const hasDeclared = Boolean(declared && declared.trim().length > 0);
    const hasDetected = Boolean(detected && detected.trim().length > 0);

    if (hasDeclared && hasDetected) {
      return declared!.trim().toLowerCase() === detected!.trim().toLowerCase()
        ? DetectionStatus.MATCH
        : DetectionStatus.CONFLICT;
    }
    if (hasDeclared && !hasDetected) {
      return DetectionStatus.DECLARED_ONLY;
    }
    if (!hasDeclared && hasDetected) {
      return DetectionStatus.DETECTED_ONLY;
    }
    return DetectionStatus.UNKNOWN;
  }
}
