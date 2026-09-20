import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service.js';
import { EnrollmentTokenService } from './enrollment-token.service.js';
import { DevicesService, RegisterDeviceParams } from '../devices/devices.service.js';
import { DeviceCredentialService, DeviceTokenPayload } from './device-credential.service.js';
import { EnrollmentTokenContext } from './enrollment-token.types.js';
import { Device, DeviceStatus, EnrollmentTokenStatus } from '@prisma/client';
import { EnrollDeviceRequestDto } from '@pharma-signal/contracts';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let enrollmentTokenServiceMock: {
    consumeToken: ReturnType<typeof jest.fn<(token: string) => Promise<EnrollmentTokenContext>>>;
  };
  let devicesServiceMock: {
    registerDevice: ReturnType<typeof jest.fn<(params: RegisterDeviceParams) => Promise<Device>>>;
  };
  let deviceCredentialServiceMock: {
    generateDeviceToken: ReturnType<
      typeof jest.fn<(payload: Omit<DeviceTokenPayload, 'iat' | 'type'>) => string>
    >;
  };

  const mockTokenContext: EnrollmentTokenContext = {
    id: 'token-uuid-1',
    organizationId: 'org-uuid-1',
    branchId: 'branch-uuid-1',
    status: EnrollmentTokenStatus.USED,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    usedAt: new Date(),
    revokedAt: null,
    createdAt: new Date()
  };

  const mockDevice: Device = {
    id: 'device-uuid-1',
    organizationId: 'org-uuid-1',
    branchId: 'branch-uuid-1',
    agentInstanceId: 'agent-uuid-1',
    hostname: 'DESKTOP-POS-1',
    os: 'Windows 11 Pro',
    appVersion: '0.1.0',
    status: DeviceStatus.ACTIVE,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    enrollmentTokenServiceMock = {
      consumeToken: jest.fn<(token: string) => Promise<EnrollmentTokenContext>>().mockResolvedValue(mockTokenContext)
    };
    devicesServiceMock = {
      registerDevice: jest.fn<(params: RegisterDeviceParams) => Promise<Device>>().mockResolvedValue(mockDevice)
    };
    deviceCredentialServiceMock = {
      generateDeviceToken: jest
        .fn<(payload: Omit<DeviceTokenPayload, 'iat' | 'type'>) => string>()
        .mockReturnValue('mock.device.token')
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        {
          provide: EnrollmentTokenService,
          useValue: enrollmentTokenServiceMock
        },
        {
          provide: DevicesService,
          useValue: devicesServiceMock
        },
        {
          provide: DeviceCredentialService,
          useValue: deviceCredentialServiceMock
        }
      ]
    }).compile();

    service = module.get<EnrollmentService>(EnrollmentService);
  });

  it('should successfully enroll a device and return credentials', async () => {
    const dto: EnrollDeviceRequestDto = {
      enrollmentToken: 'ps_et_valid_token_123',
      agentInstanceId: 'agent-uuid-1',
      hostname: 'DESKTOP-POS-1',
      os: 'Windows 11 Pro',
      appVersion: '0.1.0'
    };

    const response = await service.enrollDevice(dto);

    // 1. Verify token was consumed
    expect(enrollmentTokenServiceMock.consumeToken).toHaveBeenCalledWith('ps_et_valid_token_123');

    // 2. Verify device was registered with canonical org/branch from token
    expect(devicesServiceMock.registerDevice).toHaveBeenCalledWith({
      organizationId: 'org-uuid-1',
      branchId: 'branch-uuid-1',
      agentInstanceId: 'agent-uuid-1',
      hostname: 'DESKTOP-POS-1',
      os: 'Windows 11 Pro',
      appVersion: '0.1.0'
    });

    // 3. Verify device token was generated
    expect(deviceCredentialServiceMock.generateDeviceToken).toHaveBeenCalledWith({
      sub: 'device-uuid-1',
      deviceId: 'device-uuid-1',
      organizationId: 'org-uuid-1',
      branchId: 'branch-uuid-1',
      agentInstanceId: 'agent-uuid-1'
    });

    // 4. Verify response payload
    expect(response).toEqual({
      deviceId: 'device-uuid-1',
      organizationId: 'org-uuid-1',
      branchId: 'branch-uuid-1',
      deviceToken: 'mock.device.token',
      status: DeviceStatus.ACTIVE,
      tenantId: 'org-uuid-1'
    });
  });

  it('should accept enrollment if optional branchId matches token branch context', async () => {
    const dto: EnrollDeviceRequestDto = {
      enrollmentToken: 'ps_et_valid_token_123',
      agentInstanceId: 'agent-uuid-1',
      hostname: 'DESKTOP-POS-1',
      os: 'Windows 11 Pro',
      appVersion: '0.1.0',
      branchId: 'branch-uuid-1' // matches
    };

    const response = await service.enrollDevice(dto);
    expect(response.deviceId).toBe('device-uuid-1');
  });

  it('should reject enrollment if optional branchId contradicts token branch context', async () => {
    const dto: EnrollDeviceRequestDto = {
      enrollmentToken: 'ps_et_valid_token_123',
      agentInstanceId: 'agent-uuid-1',
      hostname: 'DESKTOP-POS-1',
      os: 'Windows 11 Pro',
      appVersion: '0.1.0',
      branchId: 'contradicting-branch-id'
    };

    await expect(service.enrollDevice(dto)).rejects.toThrow(BadRequestException);
    expect(devicesServiceMock.registerDevice).not.toHaveBeenCalled();
    expect(deviceCredentialServiceMock.generateDeviceToken).not.toHaveBeenCalled();
  });

  it('should reject enrollment if enrollment token consumption fails', async () => {
    enrollmentTokenServiceMock.consumeToken.mockRejectedValueOnce(
      new BadRequestException('Enrollment token has already been used')
    );

    const dto: EnrollDeviceRequestDto = {
      enrollmentToken: 'ps_et_used_token',
      agentInstanceId: 'agent-uuid-1',
      hostname: 'DESKTOP-POS-1',
      os: 'Windows 11 Pro',
      appVersion: '0.1.0'
    };

    await expect(service.enrollDevice(dto)).rejects.toThrow('Enrollment token has already been used');
    expect(devicesServiceMock.registerDevice).not.toHaveBeenCalled();
  });

  it('should reject enrollment if device registration fails (e.g. RETIRED device)', async () => {
    devicesServiceMock.registerDevice.mockRejectedValueOnce(
      new BadRequestException('Cannot re-enroll or update a RETIRED device')
    );

    const dto: EnrollDeviceRequestDto = {
      enrollmentToken: 'ps_et_valid_token_123',
      agentInstanceId: 'agent-retired',
      hostname: 'DESKTOP-POS-1',
      os: 'Windows 11 Pro',
      appVersion: '0.1.0'
    };

    await expect(service.enrollDevice(dto)).rejects.toThrow('Cannot re-enroll or update a RETIRED device');
    expect(deviceCredentialServiceMock.generateDeviceToken).not.toHaveBeenCalled();
  });

  it('should reject enrollment if agentInstanceId is registered to another tenant', async () => {
    devicesServiceMock.registerDevice.mockRejectedValueOnce(
      new ConflictException('Agent instance is already registered to another organization')
    );

    const dto: EnrollDeviceRequestDto = {
      enrollmentToken: 'ps_et_valid_token_123',
      agentInstanceId: 'agent-hijacked',
      hostname: 'DESKTOP-POS-1',
      os: 'Windows 11 Pro',
      appVersion: '0.1.0'
    };

    await expect(service.enrollDevice(dto)).rejects.toThrow(ConflictException);
    expect(deviceCredentialServiceMock.generateDeviceToken).not.toHaveBeenCalled();
  });
});
