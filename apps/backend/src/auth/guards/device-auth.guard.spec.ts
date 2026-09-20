import { jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { DeviceAuthGuard } from './device-auth.guard.js';
import { DeviceCredentialService, DeviceTokenPayload } from '../../enrollment/device-credential.service.js';
import { DevicesService } from '../../devices/devices.service.js';
import { DeviceWithRelations } from '../../devices/devices.repository.js';
import { DeviceStatus, OrganizationStatus, BranchStatus, OrganizationRole } from '@prisma/client';

describe('DeviceAuthGuard', () => {
  let guard: DeviceAuthGuard;
  let deviceCredentialServiceMock: {
    verifyDeviceToken: ReturnType<typeof jest.fn<(token: string) => DeviceTokenPayload>>;
  };
  let devicesServiceMock: {
    validateDeviceOperational: ReturnType<typeof jest.fn<(deviceId: string) => Promise<DeviceWithRelations>>>;
  };

  const mockPayload: DeviceTokenPayload = {
    sub: 'device-uuid-1',
    deviceId: 'device-uuid-1',
    organizationId: 'org-uuid-1',
    branchId: 'branch-uuid-1',
    agentInstanceId: 'agent-uuid-1',
    iat: Math.floor(Date.now() / 1000),
    type: 'device'
  };

  const mockDevice: DeviceWithRelations = {
    id: 'device-uuid-1',
    organizationId: 'org-uuid-1',
    branchId: 'branch-uuid-1',
    agentInstanceId: 'agent-uuid-1',
    hostname: 'POS-1',
    os: 'Windows 11',
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

  function createMockContext(headers: Record<string, string | undefined>): {
    context: ExecutionContext;
    request: any;
  } {
    const request: any = { headers };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    deviceCredentialServiceMock = {
      verifyDeviceToken: jest.fn<(token: string) => DeviceTokenPayload>().mockReturnValue(mockPayload)
    };
    devicesServiceMock = {
      validateDeviceOperational: jest.fn<(id: string) => Promise<DeviceWithRelations>>().mockResolvedValue(mockDevice)
    };

    guard = new DeviceAuthGuard(
      deviceCredentialServiceMock as unknown as DeviceCredentialService,
      devicesServiceMock as unknown as DevicesService
    );
  });

  it('should throw UnauthorizedException if Authorization header is missing', async () => {
    const { context } = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing Authorization header')
    );
  });

  it('should throw UnauthorizedException if Authorization scheme is not Bearer', async () => {
    const { context } = createMockContext({ authorization: 'Basic dXNlcjpwYXNz' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Authorization header must use Bearer scheme')
    );
  });

  it('should throw UnauthorizedException if token verification fails', async () => {
    deviceCredentialServiceMock.verifyDeviceToken.mockImplementation(() => {
      throw new UnauthorizedException('Invalid device token signature');
    });

    const { context } = createMockContext({ authorization: 'Bearer forged.token.here' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid device token signature')
    );
  });

  it('should throw UnauthorizedException if device is SUSPENDED or not operational', async () => {
    devicesServiceMock.validateDeviceOperational.mockRejectedValueOnce(
      new BadRequestException("Device 'device-uuid-1' is not in ACTIVE status (current: SUSPENDED)")
    );

    const { context } = createMockContext({ authorization: 'Bearer valid.token.here' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Device 'device-uuid-1' is not in ACTIVE status (current: SUSPENDED)")
    );
  });

  it('should throw UnauthorizedException if device is RETIRED', async () => {
    devicesServiceMock.validateDeviceOperational.mockRejectedValueOnce(
      new BadRequestException("Device 'device-uuid-1' is not in ACTIVE status (current: RETIRED)")
    );

    const { context } = createMockContext({ authorization: 'Bearer valid.token.here' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Device 'device-uuid-1' is not in ACTIVE status (current: RETIRED)")
    );
  });

  it('should throw UnauthorizedException if device does not exist in database', async () => {
    devicesServiceMock.validateDeviceOperational.mockRejectedValueOnce(
      new NotFoundException("Device with ID 'device-uuid-1' not found")
    );

    const { context } = createMockContext({ authorization: 'Bearer valid.token.here' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Device with ID 'device-uuid-1' not found")
    );
  });

  it('should authenticate valid active device and attach verified device context to request', async () => {
    const { context, request } = createMockContext({ authorization: 'Bearer valid.token.here' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.device).toEqual(mockDevice);
    expect(request.organizationId).toBe('org-uuid-1');
    expect(request.branchId).toBe('branch-uuid-1');
  });
});
