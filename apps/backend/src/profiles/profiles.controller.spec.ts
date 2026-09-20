import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import {
  DeviceStatus,
  OrganizationRole,
  OrganizationStatus,
  BranchStatus
} from '@prisma/client';
import {
  UploadProfileSnapshotRequestDto,
  UploadProfileSnapshotResponseDto,
  DatabaseClassification as ContractClassification
} from '@pharma-signal/contracts';
import { DeviceAuthGuard } from '../auth/guards/device-auth.guard.js';

describe('ProfilesController', () => {
  let controller: ProfilesController;
  let profilesServiceMock: {
    uploadProfileSnapshot: ReturnType<
      typeof jest.fn<(device: DeviceWithRelations, dto: UploadProfileSnapshotRequestDto) => Promise<UploadProfileSnapshotResponseDto>>
    >;
    getProfileById: ReturnType<typeof jest.fn>;
    getLatestProfileByDataSource: ReturnType<typeof jest.fn>;
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

  const mockResponse: UploadProfileSnapshotResponseDto = {
    profileSnapshotId: 'prof-1',
    dataSourceId: 'ds-1',
    schemaFingerprint: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
    classification: ContractClassification.SQLITE,
    confidence: 0.95
  };

  beforeEach(async () => {
    profilesServiceMock = {
      uploadProfileSnapshot: jest.fn<any>().mockResolvedValue(mockResponse),
      getProfileById: jest.fn<any>().mockResolvedValue({ id: 'prof-1' }),
      getLatestProfileByDataSource: jest.fn<any>().mockResolvedValue({ id: 'prof-1' })
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [{ provide: ProfilesService, useValue: profilesServiceMock }]
    })
      .overrideGuard(DeviceAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProfilesController>(ProfilesController);
  });

  const validDto: UploadProfileSnapshotRequestDto = {
    dataSourceId: 'ds-1',
    schemaFingerprint: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
    classification: ContractClassification.SQLITE,
    confidence: 0.95,
    evidence: { matchedColumns: ['id', 'name'] },
    reason: 'Matches SQLite column structure'
  };

  it('should delegate upload to ProfilesService', async () => {
    const result = await controller.uploadProfile(mockDevice, validDto);
    expect(result).toEqual(mockResponse);
    expect(profilesServiceMock.uploadProfileSnapshot).toHaveBeenCalledWith(mockDevice, validDto);
  });

  it('should delegate uploadProfileAlias to ProfilesService', async () => {
    const result = await controller.uploadProfileAlias(mockDevice, validDto);
    expect(result).toEqual(mockResponse);
    expect(profilesServiceMock.uploadProfileSnapshot).toHaveBeenCalledWith(mockDevice, validDto);
  });

  it('should delegate getProfileById to ProfilesService', async () => {
    const result = await controller.getProfileById(mockDevice, 'prof-1');
    expect(result).toEqual({ id: 'prof-1' });
    expect(profilesServiceMock.getProfileById).toHaveBeenCalledWith(mockDevice, 'prof-1');
  });

  it('should delegate getLatestProfile to ProfilesService', async () => {
    const result = await controller.getLatestProfile(mockDevice, 'ds-1');
    expect(result).toEqual({ id: 'prof-1' });
    expect(profilesServiceMock.getLatestProfileByDataSource).toHaveBeenCalledWith(mockDevice, 'ds-1');
  });
});
