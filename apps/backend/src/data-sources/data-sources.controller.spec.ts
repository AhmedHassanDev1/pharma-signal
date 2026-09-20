import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSourcesController } from './data-sources.controller.js';
import { DataSourcesService } from './data-sources.service.js';
import { DeviceAuthGuard } from '../auth/guards/device-auth.guard.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import {
  DeviceStatus,
  OrganizationRole,
  OrganizationStatus,
  BranchStatus
} from '@prisma/client';
import {
  RegisterDataSourceRequestDto,
  RegisterDataSourceResponseDto,
  DetectionStatus
} from '@pharma-signal/contracts';

describe('DataSourcesController', () => {
  let controller: DataSourcesController;
  let serviceMock: {
    registerDataSource: ReturnType<
      typeof jest.fn<(device: DeviceWithRelations, dto: RegisterDataSourceRequestDto) => Promise<RegisterDataSourceResponseDto>>
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

  const mockResponse: RegisterDataSourceResponseDto = {
    dataSourceId: 'ds-1111',
    organizationId: 'org-1111',
    branchId: 'branch-1111',
    deviceId: 'device-1111',
    localDataSourceKey: 'sqlite-pos-db',
    declaredSoftwareName: 'eStock',
    detectedSoftwareName: 'eStock',
    detectionStatus: DetectionStatus.MATCH,
    status: 'ACTIVE',
    tenantId: 'org-1111'
  };

  beforeEach(async () => {
    serviceMock = {
      registerDataSource: jest
        .fn<(device: DeviceWithRelations, dto: RegisterDataSourceRequestDto) => Promise<RegisterDataSourceResponseDto>>()
        .mockResolvedValue(mockResponse)
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataSourcesController],
      providers: [
        {
          provide: DataSourcesService,
          useValue: serviceMock
        }
      ]
    })
      .overrideGuard(DeviceAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DataSourcesController>(DataSourcesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call dataSourcesService.registerDataSource with authenticated device and dto', async () => {
    const dto: RegisterDataSourceRequestDto = {
      localDataSourceKey: 'sqlite-pos-db',
      engine: 'SQLite',
      databaseName: 'pos.db',
      declaredSoftwareName: 'eStock',
      detectedSoftwareName: 'eStock'
    };

    const result = await controller.registerDataSource(mockDevice, dto);

    expect(serviceMock.registerDataSource).toHaveBeenCalledWith(mockDevice, dto);
    expect(result).toEqual(mockResponse);
  });
});
