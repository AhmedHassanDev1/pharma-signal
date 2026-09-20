import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import { ProfilesService } from './profiles.service.js';
import { ProfilesRepository, CreateProfileSnapshotInput } from './profiles.repository.js';
import { DataSourcesRepository } from '../data-sources/data-sources.repository.js';
import { SchemasRepository } from '../schemas/schemas.repository.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import {
  DataSource,
  ProfileSnapshot,
  SchemaSnapshot,
  DeviceStatus,
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DetectionStatus,
  DatabaseClassification
} from '@prisma/client';
import {
  UploadProfileSnapshotRequestDto,
  DatabaseClassification as ContractClassification
} from '@pharma-signal/contracts';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let profilesRepositoryMock: {
    findById: ReturnType<typeof jest.fn<(id: string) => Promise<ProfileSnapshot | null>>>;
    findLatestByDataSource: ReturnType<
      typeof jest.fn<(dsId: string) => Promise<ProfileSnapshot | null>>
    >;
    create: ReturnType<typeof jest.fn<(data: CreateProfileSnapshotInput) => Promise<ProfileSnapshot>>>;
    findByDataSource: ReturnType<typeof jest.fn<(dsId: string) => Promise<ProfileSnapshot[]>>>;
  };
  let dataSourcesRepositoryMock: {
    findById: ReturnType<typeof jest.fn<(id: string) => Promise<DataSource | null>>>;
  };
  let schemasRepositoryMock: {
    findByDataSourceAndFingerprint: ReturnType<
      typeof jest.fn<(dsId: string, fp: string) => Promise<SchemaSnapshot | null>>
    >;
  };

  const mockDevice: DeviceWithRelations = {
    id: 'device-1111',
    organizationId: 'org-1111',
    branchId: 'branch-1111',
    agentInstanceId: 'agent-1111',
    hostname: 'POS-TEST',
    os: 'Windows 11',
    appVersion: '0.1.0',
    status: DeviceStatus.ACTIVE,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: {
      id: 'org-1111',
      name: 'Test Org',
      role: OrganizationRole.RETAIL_PHARMACY,
      status: OrganizationStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    branch: {
      id: 'branch-1111',
      organizationId: 'org-1111',
      name: 'Main Branch',
      code: 'MAIN',
      status: BranchStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  const mockDataSource: DataSource = {
    id: 'ds-1111',
    organizationId: 'org-1111',
    branchId: 'branch-1111',
    deviceId: 'device-1111',
    localDataSourceKey: 'sqlite-pos-db',
    engine: 'SQLite',
    databaseName: 'pos.db',
    declaredSoftwareName: 'eStock',
    detectedSoftwareName: 'eStock',
    detectionStatus: DetectionStatus.MATCH,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const sampleFingerprint = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const mockSchemaSnapshot: SchemaSnapshot = {
    id: 'schema-snap-1111',
    dataSourceId: 'ds-1111',
    schemaFingerprint: sampleFingerprint,
    version: 1,
    tables: [{ name: 'items' }, { name: 'sales' }],
    createdAt: new Date()
  };

  const mockProfileSnapshot: ProfileSnapshot = {
    id: 'profile-snap-1111',
    dataSourceId: 'ds-1111',
    schemaFingerprint: sampleFingerprint,
    classification: DatabaseClassification.SQLITE,
    confidence: 0.95,
    evidence: { matchedColumns: ['id', 'name'] },
    reason: 'Matches SQLite column structure',
    createdAt: new Date()
  };

  beforeEach(async () => {
    profilesRepositoryMock = {
      findById: jest.fn<any>(),
      findLatestByDataSource: jest.fn<any>(),
      create: jest.fn<any>(),
      findByDataSource: jest.fn<any>()
    };

    dataSourcesRepositoryMock = {
      findById: jest.fn<any>()
    };

    schemasRepositoryMock = {
      findByDataSourceAndFingerprint: jest.fn<any>()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: ProfilesRepository, useValue: profilesRepositoryMock },
        { provide: DataSourcesRepository, useValue: dataSourcesRepositoryMock },
        { provide: SchemasRepository, useValue: schemasRepositoryMock }
      ]
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  describe('uploadProfileSnapshot', () => {
    const validDto: UploadProfileSnapshotRequestDto = {
      dataSourceId: 'ds-1111',
      schemaFingerprint: sampleFingerprint,
      classification: ContractClassification.SQLITE,
      confidence: 0.95,
      evidence: { matchedColumns: ['id', 'name'] },
      reason: 'Matches SQLite column structure'
    };

    it('should successfully upload a profile snapshot when schema fingerprint matches', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      schemasRepositoryMock.findByDataSourceAndFingerprint.mockResolvedValue(mockSchemaSnapshot);
      profilesRepositoryMock.create.mockResolvedValue(mockProfileSnapshot);

      const result = await service.uploadProfileSnapshot(mockDevice, validDto);

      expect(result).toEqual({
        profileSnapshotId: 'profile-snap-1111',
        dataSourceId: 'ds-1111',
        schemaFingerprint: sampleFingerprint,
        classification: ContractClassification.SQLITE,
        confidence: 0.95
      });
      expect(dataSourcesRepositoryMock.findById).toHaveBeenCalledWith('ds-1111');
      expect(schemasRepositoryMock.findByDataSourceAndFingerprint).toHaveBeenCalledWith(
        'ds-1111',
        sampleFingerprint
      );
      expect(profilesRepositoryMock.create).toHaveBeenCalledWith({
        dataSourceId: 'ds-1111',
        schemaFingerprint: sampleFingerprint,
        classification: DatabaseClassification.SQLITE,
        confidence: 0.95,
        evidence: { matchedColumns: ['id', 'name'] },
        reason: 'Matches SQLite column structure'
      });
    });

    it('should throw NotFoundException if data source does not exist', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(null);

      await expect(service.uploadProfileSnapshot(mockDevice, validDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if data source belongs to another device', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue({
        ...mockDataSource,
        deviceId: 'other-device'
      });

      await expect(service.uploadProfileSnapshot(mockDevice, validDto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException if data source belongs to another organization', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue({
        ...mockDataSource,
        organizationId: 'other-org'
      });

      await expect(service.uploadProfileSnapshot(mockDevice, validDto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException if schema snapshot with fingerprint does not exist for data source', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      schemasRepositoryMock.findByDataSourceAndFingerprint.mockResolvedValue(null);

      await expect(service.uploadProfileSnapshot(mockDevice, validDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getProfileById', () => {
    it('should return profile snapshot if device owns data source', async () => {
      profilesRepositoryMock.findById.mockResolvedValue(mockProfileSnapshot);
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);

      const result = await service.getProfileById(mockDevice, 'profile-snap-1111');
      expect(result).toEqual(mockProfileSnapshot);
    });

    it('should throw NotFoundException if profile snapshot not found', async () => {
      profilesRepositoryMock.findById.mockResolvedValue(null);

      await expect(service.getProfileById(mockDevice, 'missing-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if profile snapshot belongs to data source of another device', async () => {
      profilesRepositoryMock.findById.mockResolvedValue(mockProfileSnapshot);
      dataSourcesRepositoryMock.findById.mockResolvedValue({
        ...mockDataSource,
        deviceId: 'other-device'
      });

      await expect(service.getProfileById(mockDevice, 'profile-snap-1111')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('getLatestProfileByDataSource', () => {
    it('should return latest profile snapshot for data source', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      profilesRepositoryMock.findLatestByDataSource.mockResolvedValue(mockProfileSnapshot);

      const result = await service.getLatestProfileByDataSource(mockDevice, 'ds-1111');
      expect(result).toEqual(mockProfileSnapshot);
    });

    it('should throw NotFoundException if data source does not exist', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        service.getLatestProfileByDataSource(mockDevice, 'missing-ds')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if data source belongs to another device', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue({
        ...mockDataSource,
        deviceId: 'other-device'
      });

      await expect(
        service.getLatestProfileByDataSource(mockDevice, 'ds-1111')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if no profile snapshot exists for data source', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValue(mockDataSource);
      profilesRepositoryMock.findLatestByDataSource.mockResolvedValue(null);

      await expect(
        service.getLatestProfileByDataSource(mockDevice, 'ds-1111')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
