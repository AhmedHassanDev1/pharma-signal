import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  RegisterDataSourceRequestDto,
  RegisterDataSourceResponseDto,
  DetectionStatus as ContractDetectionStatus,
  DataSourceListItemDto,
  DataSourceDetailsDto,
  TableSchema
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
    // Security: reject any client attempts to forge branch, organization, or device ownership
    const rawDto = dto as unknown as Record<string, unknown>;
    const requestedBranchId = (dto.branchId ?? rawDto.branch_id) as string | undefined;
    if (requestedBranchId && requestedBranchId !== device.branchId) {
      throw new BadRequestException(
        `Provided branchId '${requestedBranchId}' does not match authenticated device branch '${device.branchId}'`
      );
    }

    const requestedOrgId = (rawDto.organizationId ?? rawDto.organization_id) as string | undefined;
    if (requestedOrgId && requestedOrgId !== device.organizationId) {
      throw new BadRequestException(
        `Provided organizationId '${requestedOrgId}' does not match authenticated device organization '${device.organizationId}'`
      );
    }

    const requestedDeviceId = (rawDto.deviceId ?? rawDto.device_id) as string | undefined;
    if (requestedDeviceId && requestedDeviceId !== device.id) {
      throw new BadRequestException(
        `Provided deviceId '${requestedDeviceId}' does not match authenticated device '${device.id}'`
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

  async listDataSources(limit = 100): Promise<DataSourceListItemDto[]> {
    const dataSources = await this.repository.findAllWithRelations(limit);
    return dataSources.map((ds) => {
      const latestSnapshot = ds.schemaSnapshots[0];
      const tables = (latestSnapshot?.tables as any[]) ?? [];
      return {
        id: ds.id,
        organizationId: ds.organizationId,
        organizationName: ds.organization.name,
        branchId: ds.branchId,
        branchName: ds.branch.name,
        deviceId: ds.deviceId,
        deviceHostname: ds.device.hostname,
        localDataSourceKey: ds.localDataSourceKey,
        engine: ds.engine,
        databaseName: ds.databaseName,
        declaredSoftwareName: ds.declaredSoftwareName,
        detectedSoftwareName: ds.detectedSoftwareName,
        detectionStatus: ds.detectionStatus,
        status: ds.status,
        createdAt: ds.createdAt.toISOString(),
        latestSchemaVersion: latestSnapshot?.version ?? null,
        latestSchemaFingerprint: latestSnapshot?.schemaFingerprint ?? null,
        tablesCount: tables.length
      };
    });
  }

  async getDataSourceDetails(id: string): Promise<DataSourceDetailsDto> {
    const ds = await this.repository.findByIdWithRelations(id);
    if (!ds) {
      throw new NotFoundException(`Data source with ID '${id}' not found`);
    }

    const latestSnapshot = ds.schemaSnapshots[0];
    const tables = (latestSnapshot?.tables as any[]) ?? [];

    return {
      id: ds.id,
      organizationId: ds.organizationId,
      organizationName: ds.organization.name,
      branchId: ds.branchId,
      branchName: ds.branch.name,
      deviceId: ds.deviceId,
      deviceHostname: ds.device.hostname,
      localDataSourceKey: ds.localDataSourceKey,
      engine: ds.engine,
      databaseName: ds.databaseName,
      declaredSoftwareName: ds.declaredSoftwareName,
      detectedSoftwareName: ds.detectedSoftwareName,
      detectionStatus: ds.detectionStatus,
      status: ds.status,
      createdAt: ds.createdAt.toISOString(),
      latestSchemaVersion: latestSnapshot?.version ?? null,
      latestSchemaFingerprint: latestSnapshot?.schemaFingerprint ?? null,
      tablesCount: tables.length,
      latestSchema: latestSnapshot
        ? {
            id: latestSnapshot.id,
            version: latestSnapshot.version,
            schemaFingerprint: latestSnapshot.schemaFingerprint,
            tables: latestSnapshot.tables as unknown as TableSchema[],
            createdAt: latestSnapshot.createdAt.toISOString()
          }
        : null
    };
  }
}
