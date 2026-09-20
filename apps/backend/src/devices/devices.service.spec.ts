import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DevicesService, RegisterDeviceParams } from './devices.service.js';
import { DevicesRepository, DeviceWithRelations, CreateDeviceInput, UpdateDeviceInput } from './devices.repository.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { Device, DeviceStatus, OrganizationStatus, BranchStatus, OrganizationRole } from '@prisma/client';

describe('DevicesService', () => {
  let service: DevicesService;
  let devicesRepositoryMock: {
    findById: ReturnType<typeof jest.fn<(id: string) => Promise<DeviceWithRelations | null>>>;
    findByAgentInstanceId: ReturnType<typeof jest.fn<(id: string) => Promise<DeviceWithRelations | null>>>;
    create: ReturnType<typeof jest.fn<(data: CreateDeviceInput) => Promise<Device>>>;
    update: ReturnType<typeof jest.fn<(id: string, data: UpdateDeviceInput) => Promise<Device>>>;
    updateStatus: ReturnType<typeof jest.fn<(id: string, status: DeviceStatus) => Promise<Device>>>;
    updateLastSeen: ReturnType<typeof jest.fn<(id: string, timestamp?: Date) => Promise<Device>>>;
    findByBranch: ReturnType<typeof jest.fn<(branchId: string) => Promise<Device[]>>>;
    findByOrganization: ReturnType<typeof jest.fn<(orgId: string) => Promise<Device[]>>>;
  };
  let organizationsServiceMock: {
    validateBranchOwnership: ReturnType<typeof jest.fn<(orgId: string, branchId: string) => Promise<any>>>;
    getOrganization: ReturnType<typeof jest.fn<(id: string) => Promise<any>>>;
    getBranch: ReturnType<typeof jest.fn<(id: string) => Promise<any>>>;
  };

  const mockDevice: DeviceWithRelations = {
    id: 'device-uuid-1',
    organizationId: 'org-uuid-1',
    branchId: 'branch-uuid-1',
    agentInstanceId: 'agent-uuid-1',
    hostname: 'PHARMA-POS-1',
    os: 'Windows 11 Pro',
    appVersion: '0.1.0',
    status: DeviceStatus.ACTIVE,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: {
      id: 'org-uuid-1',
      name: 'Al-Amal Pharmacy',
      role: OrganizationRole.RETAIL_PHARMACY,
      status: OrganizationStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    branch: {
      id: 'branch-uuid-1',
      organizationId: 'org-uuid-1',
      name: 'Main Branch',
      code: 'MAIN-01',
      status: BranchStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  beforeEach(async () => {
    devicesRepositoryMock = {
      findById: jest.fn<(id: string) => Promise<DeviceWithRelations | null>>().mockResolvedValue(mockDevice),
      findByAgentInstanceId: jest.fn<(id: string) => Promise<DeviceWithRelations | null>>().mockResolvedValue(null),
      create: jest.fn<(data: CreateDeviceInput) => Promise<Device>>().mockImplementation(async (data) => ({
        id: 'new-device-uuid',
        organizationId: data.organizationId,
        branchId: data.branchId,
        agentInstanceId: data.agentInstanceId,
        hostname: data.hostname,
        os: data.os,
        appVersion: data.appVersion,
        status: data.status ?? DeviceStatus.ACTIVE,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      update: jest.fn<(id: string, data: UpdateDeviceInput) => Promise<Device>>().mockImplementation(async (id, data) => ({
        ...mockDevice,
        ...data,
        id
      })),
      updateStatus: jest.fn<(id: string, status: DeviceStatus) => Promise<Device>>().mockImplementation(async (id, status) => ({
        ...mockDevice,
        id,
        status
      })),
      updateLastSeen: jest.fn<(id: string, timestamp?: Date) => Promise<Device>>().mockImplementation(async (id, timestamp) => ({
        ...mockDevice,
        id,
        lastSeenAt: timestamp ?? new Date()
      })),
      findByBranch: jest.fn<(branchId: string) => Promise<Device[]>>().mockResolvedValue([mockDevice]),
      findByOrganization: jest.fn<(orgId: string) => Promise<Device[]>>().mockResolvedValue([mockDevice])
    };

    organizationsServiceMock = {
      validateBranchOwnership: jest.fn<(orgId: string, branchId: string) => Promise<any>>().mockResolvedValue({
        organization: mockDevice.organization,
        branch: mockDevice.branch
      }),
      getOrganization: jest.fn<(id: string) => Promise<any>>().mockResolvedValue(mockDevice.organization),
      getBranch: jest.fn<(id: string) => Promise<any>>().mockResolvedValue(mockDevice.branch)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: DevicesRepository,
          useValue: devicesRepositoryMock
        },
        {
          provide: OrganizationsService,
          useValue: organizationsServiceMock
        }
      ]
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  describe('getDeviceById', () => {
    it('should return device with relations when found', async () => {
      const device = await service.getDeviceById('device-uuid-1');
      expect(device).toEqual(mockDevice);
      expect(devicesRepositoryMock.findById).toHaveBeenCalledWith('device-uuid-1');
    });

    it('should throw NotFoundException when device is not found', async () => {
      devicesRepositoryMock.findById.mockResolvedValueOnce(null);
      await expect(service.getDeviceById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('registerDevice', () => {
    const registerParams: RegisterDeviceParams = {
      organizationId: 'org-uuid-1',
      branchId: 'branch-uuid-1',
      agentInstanceId: 'agent-uuid-new',
      hostname: 'POS-02',
      os: 'Windows 10',
      appVersion: '0.1.0'
    };

    it('should validate branch ownership server-side and create new device with ACTIVE status', async () => {
      const created = await service.registerDevice(registerParams);

      expect(organizationsServiceMock.validateBranchOwnership).toHaveBeenCalledWith(
        'org-uuid-1',
        'branch-uuid-1'
      );
      expect(devicesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-uuid-1',
          branchId: 'branch-uuid-1',
          agentInstanceId: 'agent-uuid-new',
          status: DeviceStatus.ACTIVE
        })
      );
      expect(created.status).toBe(DeviceStatus.ACTIVE);
    });

    it('should re-register existing device when belonging to the same organization and branch', async () => {
      devicesRepositoryMock.findByAgentInstanceId.mockResolvedValueOnce(mockDevice);

      const updated = await service.registerDevice({
        ...registerParams,
        agentInstanceId: mockDevice.agentInstanceId,
        hostname: 'UPDATED-HOST'
      });

      expect(devicesRepositoryMock.update).toHaveBeenCalledWith(
        mockDevice.id,
        expect.objectContaining({
          hostname: 'UPDATED-HOST'
        })
      );
      expect(updated.hostname).toBe('UPDATED-HOST');
    });

    it('should reject registration when agentInstanceId exists but is RETIRED', async () => {
      devicesRepositoryMock.findByAgentInstanceId.mockResolvedValueOnce({
        ...mockDevice,
        status: DeviceStatus.RETIRED
      });

      await expect(
        service.registerDevice({
          ...registerParams,
          agentInstanceId: mockDevice.agentInstanceId
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject registration when agentInstanceId is registered to a different organization or branch', async () => {
      devicesRepositoryMock.findByAgentInstanceId.mockResolvedValueOnce({
        ...mockDevice,
        organizationId: 'different-org-id',
        branchId: 'different-branch-id'
      });

      await expect(
        service.registerDevice({
          ...registerParams,
          agentInstanceId: mockDevice.agentInstanceId
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transitionStatus', () => {
    it('should transition from ACTIVE to SUSPENDED', async () => {
      const result = await service.transitionStatus('device-uuid-1', DeviceStatus.SUSPENDED);
      expect(devicesRepositoryMock.updateStatus).toHaveBeenCalledWith('device-uuid-1', DeviceStatus.SUSPENDED);
      expect(result.status).toBe(DeviceStatus.SUSPENDED);
    });

    it('should transition from ACTIVE to RETIRED', async () => {
      const result = await service.transitionStatus('device-uuid-1', DeviceStatus.RETIRED);
      expect(devicesRepositoryMock.updateStatus).toHaveBeenCalledWith('device-uuid-1', DeviceStatus.RETIRED);
      expect(result.status).toBe(DeviceStatus.RETIRED);
    });

    it('should transition from SUSPENDED to ACTIVE', async () => {
      devicesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDevice,
        status: DeviceStatus.SUSPENDED
      });

      const result = await service.transitionStatus('device-uuid-1', DeviceStatus.ACTIVE);
      expect(devicesRepositoryMock.updateStatus).toHaveBeenCalledWith('device-uuid-1', DeviceStatus.ACTIVE);
      expect(result.status).toBe(DeviceStatus.ACTIVE);
    });

    it('should reject any transition when current status is RETIRED (terminal state)', async () => {
      devicesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDevice,
        status: DeviceStatus.RETIRED
      });

      await expect(
        service.transitionStatus('device-uuid-1', DeviceStatus.ACTIVE)
      ).rejects.toThrow(BadRequestException);
    });

    it('should be a no-op when transitioning to the identical status', async () => {
      const result = await service.transitionStatus('device-uuid-1', DeviceStatus.ACTIVE);
      expect(devicesRepositoryMock.updateStatus).not.toHaveBeenCalled();
      expect(result.status).toBe(DeviceStatus.ACTIVE);
    });
  });

  describe('recordHeartbeat', () => {
    it('should update lastSeenAt for an active device', async () => {
      const result = await service.recordHeartbeat('device-uuid-1');
      expect(devicesRepositoryMock.updateLastSeen).toHaveBeenCalledWith('device-uuid-1');
      expect(result.lastSeenAt).toBeDefined();
    });

    it('should throw BadRequestException when device is RETIRED', async () => {
      devicesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDevice,
        status: DeviceStatus.RETIRED
      });

      await expect(service.recordHeartbeat('device-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateDeviceOperational', () => {
    it('should validate successfully when device, branch, and organization are all ACTIVE', async () => {
      const result = await service.validateDeviceOperational('device-uuid-1');
      expect(result).toEqual(mockDevice);
    });

    it('should throw BadRequestException when device is SUSPENDED', async () => {
      devicesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDevice,
        status: DeviceStatus.SUSPENDED
      });

      await expect(service.validateDeviceOperational('device-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when device is RETIRED', async () => {
      devicesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDevice,
        status: DeviceStatus.RETIRED
      });

      await expect(service.validateDeviceOperational('device-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when branch is INACTIVE', async () => {
      devicesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDevice,
        branch: {
          ...mockDevice.branch,
          status: BranchStatus.INACTIVE
        }
      });

      await expect(service.validateDeviceOperational('device-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when organization is SUSPENDED', async () => {
      devicesRepositoryMock.findById.mockResolvedValueOnce({
        ...mockDevice,
        organization: {
          ...mockDevice.organization,
          status: OrganizationStatus.SUSPENDED
        }
      });

      await expect(service.validateDeviceOperational('device-uuid-1')).rejects.toThrow(BadRequestException);
    });
  });
});
