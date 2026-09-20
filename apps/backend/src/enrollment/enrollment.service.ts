import { Injectable, BadRequestException } from '@nestjs/common';
import { EnrollDeviceRequestDto, EnrollDeviceResponseDto, DeviceStatus } from '@pharma-signal/contracts';
import { EnrollmentTokenService } from './enrollment-token.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { DeviceCredentialService } from './device-credential.service.js';

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly enrollmentTokenService: EnrollmentTokenService,
    private readonly devicesService: DevicesService,
    private readonly deviceCredentialService: DeviceCredentialService
  ) {}

  /**
   * Orchestrates device enrollment:
   * 1. Consumes enrollment token atomically (ensuring single-use, unexpired, active).
   * 2. Verifies branch consistency if client supplied an optional branchId hint.
   * 3. Registers or re-enrolls the device via DevicesService (server-enforced ownership).
   * 4. Issues signed deviceToken for subsequent Bearer device authentication.
   * 5. Returns canonical device identity and credentials.
   */
  async enrollDevice(dto: EnrollDeviceRequestDto): Promise<EnrollDeviceResponseDto> {
    // 1. Atomically consume enrollment token
    const tokenContext = await this.enrollmentTokenService.consumeToken(dto.enrollmentToken);

    // 2. Validate optional branchId client hint against canonical token context
    if (dto.branchId && dto.branchId !== tokenContext.branchId) {
      throw new BadRequestException(
        `Branch ID '${dto.branchId}' does not match enrollment token branch context ('${tokenContext.branchId}')`
      );
    }

    // 3. Register or re-register device with server-owned organization and branch context
    const device = await this.devicesService.registerDevice({
      organizationId: tokenContext.organizationId,
      branchId: tokenContext.branchId,
      agentInstanceId: dto.agentInstanceId,
      hostname: dto.hostname,
      os: dto.os,
      appVersion: dto.appVersion
    });

    // 4. Issue signed device credential
    const deviceToken = this.deviceCredentialService.generateDeviceToken({
      sub: device.id,
      deviceId: device.id,
      organizationId: device.organizationId,
      branchId: device.branchId,
      agentInstanceId: device.agentInstanceId
    });

    // 5. Return standardized enrollment response
    return {
      deviceId: device.id,
      organizationId: device.organizationId,
      branchId: device.branchId,
      deviceToken,
      status: device.status as unknown as DeviceStatus,
      tenantId: device.organizationId
    };
  }
}
