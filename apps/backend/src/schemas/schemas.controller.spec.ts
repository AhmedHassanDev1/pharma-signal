import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SchemasController } from './schemas.controller.js';
import { SchemasService } from './schemas.service.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import { DeviceStatus, OrganizationRole, OrganizationStatus, BranchStatus } from '@prisma/client';
import {
  UploadSchemaSnapshotRequestDto,
  UploadSchemaSnapshotResponseDto
} from '@pharma-signal/contracts';

import { DeviceAuthGuard } from '../auth/guards/device-auth.guard.js';

describe('SchemasController', () => {
  let controller: SchemasController;
  let schemasServiceMock: {
    uploadSchemaSnapshot: ReturnType<
      typeof jest.fn<(device: DeviceWithRelations, dto: UploadSchemaSnapshotRequestDto) => Promise<UploadSchemaSnapshotResponseDto>>
    >;
    getSnapshotById: ReturnType<typeof jest.fn>;
    getLatestSnapshotByDataSource: ReturnType<typeof jest.fn>;
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

  const mockResponse: UploadSchemaSnapshotResponseDto = {
    snapshotId: 'snap-1',
    dataSourceId: 'ds-1',
    schemaFingerprint: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
    version: 1,
    isNewVersion: true
  };

  beforeEach(async () => {
    schemasServiceMock = {
      uploadSchemaSnapshot: jest.fn<any>().mockResolvedValue(mockResponse),
      getSnapshotById: jest.fn<any>().mockResolvedValue({ id: 'snap-1' }),
      getLatestSnapshotByDataSource: jest.fn<any>().mockResolvedValue({ id: 'snap-1' })
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchemasController],
      providers: [{ provide: SchemasService, useValue: schemasServiceMock }]
    })
      .overrideGuard(DeviceAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SchemasController>(SchemasController);
  });

  it('should delegate upload to SchemasService', async () => {
    const dto: UploadSchemaSnapshotRequestDto = {
      dataSourceId: 'ds-1',
      schemaFingerprint: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
      tables: []
    };

    const result = await controller.uploadSchema(mockDevice, dto);
    expect(result).toEqual(mockResponse);
    expect(schemasServiceMock.uploadSchemaSnapshot).toHaveBeenCalledWith(mockDevice, dto);
  });
});
