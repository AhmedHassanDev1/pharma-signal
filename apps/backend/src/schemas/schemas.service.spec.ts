import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import { SchemasService } from './schemas.service.js';
import { SchemasRepository, CreateSchemaSnapshotInput } from './schemas.repository.js';
import { DataSourcesRepository } from '../data-sources/data-sources.repository.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import {
  DataSource,
  SchemaSnapshot,
  DeviceStatus,
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DetectionStatus
} from '@prisma/client';
import {
  UploadSchemaSnapshotRequestDto,
  TableSchema
} from '@pharma-signal/contracts';
import { computeSchemaFingerprint } from './schema-fingerprint.util.js';

describe('SchemasService', () => {
  let service: SchemasService;
  let schemasRepositoryMock: {
    findById: ReturnType<typeof jest.fn<(id: string) => Promise<SchemaSnapshot | null>>>;
    findByDataSourceAndFingerprint: ReturnType<
      typeof jest.fn<(dsId: string, fp: string) => Promise<SchemaSnapshot | null>>
    >;
    findLatestByDataSource: ReturnType<
      typeof jest.fn<(dsId: string) => Promise<SchemaSnapshot | null>>
    >;
    create: ReturnType<typeof jest.fn<(data: CreateSchemaSnapshotInput) => Promise<SchemaSnapshot>>>;
    findByDataSource: ReturnType<typeof jest.fn<(dsId: string) => Promise<SchemaSnapshot[]>>>;
  };
  let dataSourcesRepositoryMock: {
    findById: ReturnType<typeof jest.fn<(id: string) => Promise<DataSource | null>>>;
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

  const sampleTables: TableSchema[] = [
    {
      name: 'items',
      columns: [
        { name: 'id', dataType: 'TEXT', isNullable: false, isPrimaryKey: true },
        { name: 'name', dataType: 'TEXT', isNullable: false, isPrimaryKey: false }
      ],
      primaryKey: ['id']
    }
  ];

  const canonicalFingerprint = computeSchemaFingerprint(sampleTables);

  const mockSnapshot: SchemaSnapshot = {
    id: 'snapshot-1111',
    dataSourceId: 'ds-1111',
    schemaFingerprint: canonicalFingerprint,
    tables: sampleTables as any,
    version: 1,
    createdAt: new Date()
  };

  beforeEach(async () => {
    schemasRepositoryMock = {
      findById: jest.fn<(id: string) => Promise<SchemaSnapshot | null>>().mockResolvedValue(mockSnapshot),
      findByDataSourceAndFingerprint: jest
        .fn<(dsId: string, fp: string) => Promise<SchemaSnapshot | null>>()
        .mockResolvedValue(null),
      findLatestByDataSource: jest
        .fn<(dsId: string) => Promise<SchemaSnapshot | null>>()
        .mockResolvedValue(null),
      create: jest
        .fn<(data: CreateSchemaSnapshotInput) => Promise<SchemaSnapshot>>()
        .mockImplementation(async (data) => ({
          id: 'new-snapshot-id',
          dataSourceId: data.dataSourceId,
          schemaFingerprint: data.schemaFingerprint,
          tables: data.tables as any,
          version: data.version,
          createdAt: new Date()
        })),
      findByDataSource: jest.fn<(dsId: string) => Promise<SchemaSnapshot[]>>().mockResolvedValue([mockSnapshot])
    };

    dataSourcesRepositoryMock = {
      findById: jest.fn<(id: string) => Promise<DataSource | null>>().mockResolvedValue(mockDataSource)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchemasService,
        { provide: SchemasRepository, useValue: schemasRepositoryMock },
        { provide: DataSourcesRepository, useValue: dataSourcesRepositoryMock }
      ]
    }).compile();

    service = module.get<SchemasService>(SchemasService);
  });

  describe('uploadSchemaSnapshot', () => {
    const validDto: UploadSchemaSnapshotRequestDto = {
      dataSourceId: 'ds-1111',
      schemaFingerprint: canonicalFingerprint,
      tables: sampleTables
    };

    it('should create a new schema snapshot with version 1 and isNewVersion=true when none exists', async () => {
      const result = await service.uploadSchemaSnapshot(mockDevice, validDto);

      expect(schemasRepositoryMock.create).toHaveBeenCalledWith({
        dataSourceId: 'ds-1111',
        schemaFingerprint: canonicalFingerprint,
        tables: sampleTables,
        version: 1
      });
      expect(result.isNewVersion).toBe(true);
      expect(result.version).toBe(1);
      expect(result.snapshotId).toBe('new-snapshot-id');
    });

    it('should return existing snapshot with isNewVersion=false when same fingerprint is re-uploaded', async () => {
      schemasRepositoryMock.findByDataSourceAndFingerprint.mockResolvedValueOnce(mockSnapshot);

      const result = await service.uploadSchemaSnapshot(mockDevice, validDto);

      expect(schemasRepositoryMock.create).not.toHaveBeenCalled();
      expect(result.isNewVersion).toBe(false);
      expect(result.snapshotId).toBe('snapshot-1111');
      expect(result.version).toBe(1);
    });

    it('should increment version when a new fingerprint is uploaded for the same dataSource', async () => {
      schemasRepositoryMock.findLatestByDataSource.mockResolvedValueOnce(mockSnapshot); // version 1 exists

      const newTables: TableSchema[] = [
        ...sampleTables,
        {
          name: 'categories',
          columns: [{ name: 'id', dataType: 'TEXT', isNullable: false, isPrimaryKey: true }],
          primaryKey: ['id']
        }
      ];
      const newFp = computeSchemaFingerprint(newTables);

      const result = await service.uploadSchemaSnapshot(mockDevice, {
        dataSourceId: 'ds-1111',
        schemaFingerprint: newFp,
        tables: newTables
      });

      expect(schemasRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          schemaFingerprint: newFp
        })
      );
      expect(result.isNewVersion).toBe(true);
      expect(result.version).toBe(2);
    });

    it('should throw NotFoundException when dataSource does not exist', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValueOnce(null);

      await expect(service.uploadSchemaSnapshot(mockDevice, validDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when dataSource belongs to a different device', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDataSource,
        deviceId: 'different-device-id'
      });

      await expect(service.uploadSchemaSnapshot(mockDevice, validDto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException when client-supplied schemaFingerprint does not match computed fingerprint', async () => {
      await expect(
        service.uploadSchemaSnapshot(mockDevice, {
          ...validDto,
          schemaFingerprint: '0000000000000000000000000000000000000000000000000000000000000000'
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSnapshotById', () => {
    it('should return snapshot when device owns the data source', async () => {
      const result = await service.getSnapshotById(mockDevice, 'snapshot-1111');
      expect(result).toEqual(mockSnapshot);
    });

    it('should throw ForbiddenException if device does not own the data source', async () => {
      dataSourcesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDataSource,
        deviceId: 'other-device'
      });

      await expect(service.getSnapshotById(mockDevice, 'snapshot-1111')).rejects.toThrow(
        ForbiddenException
      );
    });
  });
});
