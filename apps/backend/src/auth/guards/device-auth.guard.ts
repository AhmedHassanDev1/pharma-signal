import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { DeviceCredentialService } from '../../enrollment/device-credential.service.js';
import { DevicesService } from '../../devices/devices.service.js';

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly deviceCredentialService: DeviceCredentialService,
    private readonly devicesService: DevicesService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization || request.headers.Authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Authorization header must use Bearer scheme');
    }

    // 1. Verify device token cryptographic signature and claims
    const payload = this.deviceCredentialService.verifyDeviceToken(token);

    // 2. Validate server-side device operational state in database
    // Ensures device exists, device is ACTIVE (not SUSPENDED/RETIRED),
    // and both branch and organization are ACTIVE.
    try {
      const device = await this.devicesService.validateDeviceOperational(payload.deviceId);

      // 3. Attach canonical server-verified device and tenant context to request
      request.device = device;
      request.organizationId = device.organizationId;
      request.branchId = device.branchId;

      return true;
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw new UnauthorizedException(err.message);
      }
      throw err;
    }
  }
}
