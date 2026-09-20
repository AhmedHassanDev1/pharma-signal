import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSourcesService } from './data-sources.service.js';
import {
  DataSourcesRepository,
  CreateDataSourceInput,
  UpdateDataSourceInput
} from './data-sources.repository.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import {
  DataSource,
  DetectionStatus,
  DeviceStatus,
  OrganizationRole,
  OrganizationStatus,
  BranchStatus
} from '@prisma/client';
import { RegisterDataSourceRequestDto } from '@pharma-signal/contracts';

describe('DataSourcesService', () => {
  let service: DataSourcesService;
  let repositoryMock: {
    findById: ReturnType<typeof jest.fn<(id: string) => Promise<DataSource | null>>>;
    findByDeviceAndLocalKey: ReturnType<
      typeof jest.fn<(deviceId: string, localKey: string) => Promise<DataSource | null>>
    >;
    create: ReturnType<typeof jest.fn<(data: CreateDataSourceInput) => Promise<DataSource>>>;
    update: ReturnType<typeof jest.fn<(id: string, data: UpdateDataSourceInput) => Promise<DataSource>>>;
    findByBranch: ReturnType<typeof jest.fn<(branchId: string) => Promise<DataSource[]>>>;
    findByOrganization: ReturnType<typeof jest.fn<(orgId: string) => Promise<DataSource[]>>>;
    findByDevice: ReturnType<typeof jest.fn<(deviceId: string) => Promise<DataSource[]>>>;
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

  beforeEach(async () => {
    repositoryMock = {
      findById: jest.fn<(id: string) => Promise<DataSource | null>>().mockResolvedValue(mockDataSource),
      findByDeviceAndLocalKey: jest
        .fn<(deviceId: string, localKey: string) => Promise<DataSource | null>>()
        .mockResolvedValue(null),
      create: jest.fn<(data: CreateDataSourceInput) => Promise<DataSource>>().mockImplementation(async (data) => ({
        id: 'new-ds-id',
        organizationId: data.organizationId,
        branchId: data.branchId,
        deviceId: data.deviceId,
        localDataSourceKey: data.localDataSourceKey,
        engine: data.engine,
        databaseName: data.databaseName,
        declaredSoftwareName: data.declaredSoftwareName ?? null,
        detectedSoftwareName: data.detectedSoftwareName ?? null,
        detectionStatus: data.detectionStatus,
        status: data.status ?? 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      update: jest.fn<(id: string, data: UpdateDataSourceInput) => Promise<DataSource>>().mockImplementation(async (id, data) => ({
        ...mockDataSource,
        ...data,
        id
      })),
      findByBranch: jest.fn<(branchId: string) => Promise<DataSource[]>>().mockResolvedValue([mockDataSource]),
      findByOrganization: jest.fn<(orgId: string) => Promise<DataSource[]>>().mockResolvedValue([mockDataSource]),
      findByDevice: jest.fn<(deviceId: string) => Promise<DataSource[]>>().mockResolvedValue([mockDataSource])
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSourcesService,
        {
          provide: DataSourcesRepository,
          useValue: repositoryMock
        }
      ]
    }).compile();

    service = module.get<DataSourcesService>(DataSourcesService);
  });

  describe('registerDataSource', () => {
    const validDto: RegisterDataSourceRequestDto = {
      localDataSourceKey: 'sqlite-pos-db',
      engine: 'SQLite',
      databaseName: 'pos.db',
      declaredSoftwareName: 'eStock',
      detectedSoftwareName: 'eStock'
    };

    it('should create new data source when none exists for (deviceId, localDataSourceKey)', async () => {
      const result = await service.registerDataSource(mockDevice, validDto);

      expect(repositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1111',
          branchId: 'branch-1111',
          deviceId: 'device-1111',
          localDataSourceKey: 'sqlite-pos-db',
          engine: 'SQLite',
          databaseName: 'pos.db',
          declaredSoftwareName: 'eStock',
          detectedSoftwareName: 'eStock',
          detectionStatus: DetectionStatus.MATCH,
          status: 'ACTIVE'
        })
      );
      expect(result.dataSourceId).toBe('new-ds-id');
      expect(result.organizationId).toBe('org-1111');
      expect(result.branchId).toBe('branch-1111');
      expect(result.deviceId).toBe('device-1111');
      expect(result.detectionStatus).toBe('MATCH');
      expect(result.tenantId).toBe('org-1111');
    });

    it('should idempotently update existing data source when one already exists', async () => {
      repositoryMock.findByDeviceAndLocalKey.mockResolvedValueOnce(mockDataSource);

      const updateDto: RegisterDataSourceRequestDto = {
        localDataSourceKey: 'sqlite-pos-db',
        engine: 'SQLite',
        databaseName: 'pos_updated.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'SofTech'
      };

      const result = await service.registerDataSource(mockDevice, updateDto);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        mockDataSource.id,
        expect.objectContaining({
          engine: 'SQLite',
          databaseName: 'pos_updated.db',
          declaredSoftwareName: 'eStock',
          detectedSoftwareName: 'SofTech',
          detectionStatus: DetectionStatus.CONFLICT,
          status: 'ACTIVE'
        })
      );
      expect(result.dataSourceId).toBe(mockDataSource.id);
      expect(result.detectionStatus).toBe('CONFLICT');
    });

    it('should reject registration when client-supplied branchId does not match authenticated device branchId', async () => {
      const spoofedDto: RegisterDataSourceRequestDto = {
        ...validDto,
        branchId: 'different-branch-id'
      };

      await expect(service.registerDataSource(mockDevice, spoofedDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject registration when client-supplied branch_id does not match authenticated device branchId', async () => {
      const spoofedDto = {
        ...validDto,
        branch_id: 'different-branch-id'
      } as unknown as RegisterDataSourceRequestDto;

      await expect(service.registerDataSource(mockDevice, spoofedDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should reject registration when client-supplied organizationId/organization_id does not match authenticated device organizationId', async () => {
      await expect(
        service.registerDataSource(mockDevice, {
          ...validDto,
          organizationId: 'different-org-id'
        } as unknown as RegisterDataSourceRequestDto)
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.registerDataSource(mockDevice, {
          ...validDto,
          organization_id: 'different-org-id'
        } as unknown as RegisterDataSourceRequestDto)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject registration when client-supplied deviceId/device_id does not match authenticated device id', async () => {
      await expect(
        service.registerDataSource(mockDevice, {
          ...validDto,
          deviceId: 'different-device-id'
        } as unknown as RegisterDataSourceRequestDto)
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.registerDataSource(mockDevice, {
          ...validDto,
          device_id: 'different-device-id'
        } as unknown as RegisterDataSourceRequestDto)
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept registration when client-supplied branchId matches authenticated device branchId', async () => {
      const matchingDto: RegisterDataSourceRequestDto = {
        ...validDto,
        branchId: mockDevice.branchId
      };

      const result = await service.registerDataSource(mockDevice, matchingDto);
      expect(result.branchId).toBe(mockDevice.branchId);
    });
  });

  describe('calculateDetectionStatus', () => {
    it('should return MATCH when declared and detected are identical (case insensitive)', () => {
      expect(service.calculateDetectionStatus('eStock', 'ESTOCK')).toBe(DetectionStatus.MATCH);
      expect(service.calculateDetectionStatus('  SofTech  ', 'softech')).toBe(DetectionStatus.MATCH);
    });

    it('should return CONFLICT when declared and detected differ', () => {
      expect(service.calculateDetectionStatus('eStock', 'SofTech')).toBe(DetectionStatus.CONFLICT);
    });

    it('should return DECLARED_ONLY when only declared is provided', () => {
      expect(service.calculateDetectionStatus('eStock', null)).toBe(DetectionStatus.DECLARED_ONLY);
      expect(service.calculateDetectionStatus('eStock', '')).toBe(DetectionStatus.DECLARED_ONLY);
      expect(service.calculateDetectionStatus('eStock', undefined)).toBe(DetectionStatus.DECLARED_ONLY);
    });

    it('should return DETECTED_ONLY when only detected is provided', () => {
      expect(service.calculateDetectionStatus(null, 'eStock')).toBe(DetectionStatus.DETECTED_ONLY);
      expect(service.calculateDetectionStatus('', 'eStock')).toBe(DetectionStatus.DETECTED_ONLY);
      expect(service.calculateDetectionStatus(undefined, 'eStock')).toBe(DetectionStatus.DETECTED_ONLY);
    });

    it('should return UNKNOWN when neither is provided', () => {
      expect(service.calculateDetectionStatus(null, null)).toBe(DetectionStatus.UNKNOWN);
      expect(service.calculateDetectionStatus('', '')).toBe(DetectionStatus.UNKNOWN);
      expect(service.calculateDetectionStatus(undefined, undefined)).toBe(DetectionStatus.UNKNOWN);
    });
  });

  describe('getDataSourceById', () => {
    it('should return data source when found', async () => {
      const result = await service.getDataSourceById('ds-1111');
      expect(result).toEqual(mockDataSource);
      expect(repositoryMock.findById).toHaveBeenCalledWith('ds-1111');
    });

    it('should throw NotFoundException when not found', async () => {
      repositoryMock.findById.mockResolvedValueOnce(null);
      await expect(service.getDataSourceById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
