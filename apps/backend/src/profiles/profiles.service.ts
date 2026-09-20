import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import {
  UploadProfileSnapshotRequestDto,
  UploadProfileSnapshotResponseDto,
  DatabaseClassification as ContractClassification
} from '@pharma-signal/contracts';
import { ProfileSnapshot, DatabaseClassification } from '@prisma/client';
import { ProfilesRepository } from './profiles.repository.js';
import { DataSourcesRepository } from '../data-sources/data-sources.repository.js';
import { SchemasRepository } from '../schemas/schemas.repository.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly dataSourcesRepository: DataSourcesRepository,
    private readonly schemasRepository: SchemasRepository
  ) {}

  /**
   * Uploads and stores a ProfileSnapshot for a verified DataSource.
   *
   * Validations:
   * 1. The DataSource must exist.
   * 2. The DataSource must belong to the authenticated device's deviceId and organizationId.
   * 3. The schema_fingerprint must correspond to a known SchemaSnapshot for this DataSource.
   * 4. Stores classification, confidence, evidence, and reason.
   */
  async uploadProfileSnapshot(
    device: DeviceWithRelations,
    dto: UploadProfileSnapshotRequestDto
  ): Promise<UploadProfileSnapshotResponseDto> {
    const dataSource = await this.dataSourcesRepository.findById(dto.dataSourceId);
    if (!dataSource) {
      throw new NotFoundException(`Data source with ID '${dto.dataSourceId}' not found`);
    }

    if (
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(
        `Device does not have access to data source '${dto.dataSourceId}'`
      );
    }

    // Verify schemaFingerprint exists for this dataSource
    const schemaSnapshot = await this.schemasRepository.findByDataSourceAndFingerprint(
      dataSource.id,
      dto.schemaFingerprint
    );

    if (!schemaSnapshot) {
      throw new BadRequestException(
        `Schema snapshot with fingerprint '${dto.schemaFingerprint}' does not exist for data source '${dto.dataSourceId}'. Please upload schema snapshot first.`
      );
    }

    const created = await this.profilesRepository.create({
      dataSourceId: dataSource.id,
      schemaFingerprint: dto.schemaFingerprint,
      classification: dto.classification as unknown as DatabaseClassification,
      confidence: dto.confidence,
      evidence: dto.evidence,
      reason: dto.reason
    });

    return {
      profileSnapshotId: created.id,
      dataSourceId: created.dataSourceId,
      schemaFingerprint: created.schemaFingerprint,
      classification: created.classification as unknown as ContractClassification,
      confidence: created.confidence
    };
  }

  async getProfileById(device: DeviceWithRelations, id: string): Promise<ProfileSnapshot> {
    const profile = await this.profilesRepository.findById(id);
    if (!profile) {
      throw new NotFoundException(`Profile snapshot with ID '${id}' not found`);
    }

    const dataSource = await this.dataSourcesRepository.findById(profile.dataSourceId);
    if (
      !dataSource ||
      dataSource.deviceId !== device.id ||
      dataSource.organizationId !== device.organizationId
    ) {
      throw new ForbiddenException(`Device does not have access to this profile snapshot`);
    }

    return profile;
  }

  async getLatestProfileByDataSource(
    device: DeviceWithRelations,
    dataSourceId: string
  ): Promise<ProfileSnapshot> {
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

    const latest = await this.profilesRepository.findLatestByDataSource(dataSourceId);
    if (!latest) {
      throw new NotFoundException(
        `No profile snapshot found for data source '${dataSourceId}'`
      );
    }

    return latest;
  }
}
