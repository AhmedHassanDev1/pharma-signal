import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import {
  DeviceStatus,
  OrganizationRole,
  OrganizationStatus,
  BranchStatus
} from '@prisma/client';
import {
  CanonicalSyncRequestDto,
  CanonicalSyncResponseDto,
  SyncBatchStatus as ContractSyncBatchStatus
} from '@pharma-signal/contracts';
import { DeviceAuthGuard } from '../auth/guards/device-auth.guard.js';

describe('SyncController', () => {
  let controller: SyncController;
  let syncServiceMock: {
    processSync: ReturnType<typeof jest.fn>;
    getBatchBySyncBatchId: ReturnType<typeof jest.fn>;
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

  const mockResponse: CanonicalSyncResponseDto = {
    syncBatchId: 'batch-1111',
    status: ContractSyncBatchStatus.COMPLETED,
    receivedCounts: { products: 1, batches: 0, inventories: 0, suppliers: 0, totalRecords: 1 },
    appliedCounts: { products: 1, batches: 0, inventories: 0, suppliers: 0, totalRecords: 1 },
    rejectedCounts: 0,
    message: 'Sync batch processed successfully'
  };

  beforeEach(async () => {
    syncServiceMock = {
      processSync: jest.fn<any>().mockResolvedValue(mockResponse),
      getBatchBySyncBatchId: jest.fn<any>().mockResolvedValue({ id: 'batch-1' })
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [{ provide: SyncService, useValue: syncServiceMock }]
    })
      .overrideGuard(DeviceAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SyncController>(SyncController);
  });

  it('should delegate sync call to SyncService with header and body', async () => {
    const dto: CanonicalSyncRequestDto = {
      dataSourceId: 'ds-1111',
      syncBatchId: 'batch-1111',
      products: []
    };

    const result = await controller.sync(mockDevice, 'batch-1111', dto);
    expect(result).toEqual(mockResponse);
    expect(syncServiceMock.processSync).toHaveBeenCalledWith(mockDevice, dto, 'batch-1111');
  });

  it('should delegate getBatch to SyncService', async () => {
    const result = await controller.getBatch(mockDevice, 'batch-1111', 'ds-1111');
    expect(result).toEqual({ id: 'batch-1' });
    expect(syncServiceMock.getBatchBySyncBatchId).toHaveBeenCalledWith(
      mockDevice,
      'ds-1111',
      'batch-1111'
    );
  });
});
