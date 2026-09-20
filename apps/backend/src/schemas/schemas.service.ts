import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import {
  UploadSchemaSnapshotRequestDto,
  UploadSchemaSnapshotResponseDto
} from '@pharma-signal/contracts';
import { SchemaSnapshot } from '@prisma/client';
import { SchemasRepository } from './schemas.repository.js';
import { DataSourcesRepository } from '../data-sources/data-sources.repository.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import { computeSchemaFingerprint } from './schema-fingerprint.util.js';

@Injectable()
export class SchemasService {
  constructor(
    private readonly schemasRepository: SchemasRepository,
    private readonly dataSourcesRepository: DataSourcesRepository
  ) {}

  /**
   * Uploads and stores an immutable SchemaSnapshot for a verified DataSource.
   *
   * Rules:
   * 1. The DataSource must exist.
   * 2. The DataSource must belong to the authenticated device's deviceId and organizationId.
   * 3. The schema fingerprint is deterministically verified via canonical hashing (SHA-256).
   * 4. If an identical schema snapshot (same dataSourceId + schemaFingerprint) already exists,
   *    it returns the existing snapshot with isNewVersion: false (immutable & idempotent).
   * 5. If it is a new schema fingerprint, it increments the version (latest + 1) and creates
   *    a new immutable snapshot record with isNewVersion: true.
   */
  async uploadSchemaSnapshot(
    device: DeviceWithRelations,
    dto: UploadSchemaSnapshotRequestDto
  ): Promise<UploadSchemaSnapshotResponseDto> {
    const dataSource = await this.dataSourcesRepository.findById(dto.dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(`Data source with ID '${dto.dataSourceId}' not found`);
    }

    // Tenant and device boundary check
    if (
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(
        `Device does not have access to data source '${dto.dataSourceId}'`
      );
    }

    // Deterministically compute canonical SHA-256 fingerprint from tables
    const computedFingerprint = computeSchemaFingerprint(dto.tables);

    // If client supplied a schemaFingerprint that differs from computed canonical fingerprint, reject
    if (
      dto.schemaFingerprint &&
      dto.schemaFingerprint.toLowerCase() !== computedFingerprint.toLowerCase()
    ) {
      throw new BadRequestException(
        `Provided schemaFingerprint '${dto.schemaFingerprint}' does not match computed canonical fingerprint '${computedFingerprint}'`
      );
    }

    const canonicalFingerprint = computedFingerprint;

    // Check if snapshot already exists for this (dataSourceId, schemaFingerprint)
    const existing = await this.schemasRepository.findByDataSourceAndFingerprint(
      dataSource.id,
      canonicalFingerprint
    );

    if (existing) {
      return {
        snapshotId: existing.id,
        dataSourceId: existing.dataSourceId,
        schemaFingerprint: existing.schemaFingerprint,
        version: existing.version,
        isNewVersion: false
      };
    }

    // Determine version for new snapshot
    const latest = await this.schemasRepository.findLatestByDataSource(dataSource.id);
    const newVersion = latest ? latest.version + 1 : 1;

    const created = await this.schemasRepository.create({
      dataSourceId: dataSource.id,
      schemaFingerprint: canonicalFingerprint,
      tables: dto.tables,
      version: newVersion
    });

    return {
      snapshotId: created.id,
      dataSourceId: created.dataSourceId,
      schemaFingerprint: created.schemaFingerprint,
      version: created.version,
      isNewVersion: true
    };
  }

  async getSnapshotById(device: DeviceWithRelations, id: string): Promise<SchemaSnapshot> {
    const snapshot = await this.schemasRepository.findById(id);
    if (!snapshot) {
      throw new NotFoundException(`Schema snapshot with ID '${id}' not found`);
    }

    const dataSource = await this.dataSourcesRepository.findById(snapshot.dataSourceId);
    if (
      !dataSource ||
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(`Device does not have access to this schema snapshot`);
    }

    return snapshot;
  }

  async getLatestSnapshotByDataSource(
    device: DeviceWithRelations,
    dataSourceId: string
  ): Promise<SchemaSnapshot> {
    const dataSource = await this.dataSourcesRepository.findById(dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(`Data source with ID '${dataSourceId}' not found`);
    }

    if (
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(
        `Device does not have access to data source '${dataSourceId}'`
      );
    }

    const latest = await this.schemasRepository.findLatestByDataSource(dataSourceId);
    if (!latest) {
      throw new NotFoundException(
        `No schema snapshot found for data source '${dataSourceId}'`
      );
    }

    return latest;
  }
}
