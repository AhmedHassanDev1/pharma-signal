import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { Device, DeviceStatus, OrganizationStatus, BranchStatus } from '@prisma/client';
import { DevicesRepository, DeviceWithRelations } from './devices.repository.js';
import { OrganizationsService } from '../organizations/organizations.service.js';

export interface RegisterDeviceParams {
  organizationId: string;
  branchId: string;
  agentInstanceId: string;
  hostname: string;
  os: string;
  appVersion: string;
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly organizationsService: OrganizationsService
  ) {}

  async getDeviceById(deviceId: string): Promise<DeviceWithRelations> {
    const device = await this.devicesRepository.findById(deviceId);
    if (!device) {
      throw new NotFoundException(`Device with ID '${deviceId}' not found`);
    }
    return device;
  }

  async getDeviceByAgentInstanceId(agentInstanceId: string): Promise<DeviceWithRelations | null> {
    return this.devicesRepository.findByAgentInstanceId(agentInstanceId);
  }

  /**
   * Registers a new device or updates an existing device registration.
   * 
   * Server-side ownership rules:
   * 1. Validates that organization exists and is ACTIVE.
   * 2. Validates that branch exists, belongs to the organization, and is ACTIVE.
   * 3. Prevents re-enrolling or updating RETIRED devices.
   * 4. Prevents hijacking an agent_instance_id registered to another organization/branch.
   */
  async registerDevice(params: RegisterDeviceParams): Promise<Device> {
    // 1. Verify server-side ownership and active state
    await this.organizationsService.validateBranchOwnership(params.organizationId, params.branchId);

    // 2. Check if agent_instance_id is already registered
    const existing = await this.devicesRepository.findByAgentInstanceId(params.agentInstanceId);

    if (existing) {
      if (existing.status === DeviceStatus.RETIRED) {
        throw new BadRequestException(
          `Cannot re-enroll or update a RETIRED device ('${existing.id}'). A new agent instance identity must be generated.`
        );
      }

      if (
        existing.organizationId !== params.organizationId ||
        existing.branchId !== params.branchId
      ) {
        throw new ConflictException(
          `Agent instance '${params.agentInstanceId}' is already registered to organization '${existing.organizationId}' and branch '${existing.branchId}'`
        );
      }

      // Re-registration of active/suspended device: update metadata and refresh lastSeenAt
      return this.devicesRepository.update(existing.id, {
        hostname: params.hostname,
        os: params.os,
        appVersion: params.appVersion,
        lastSeenAt: new Date()
      });
    }

    // 3. Create new device with server-assigned UUID and ACTIVE status
    return this.devicesRepository.create({
      organizationId: params.organizationId,
      branchId: params.branchId,
      agentInstanceId: params.agentInstanceId,
      hostname: params.hostname,
      os: params.os,
      appVersion: params.appVersion,
      status: DeviceStatus.ACTIVE
    });
  }

  /**
   * Transitions a device between lifecycle states:
   * - ACTIVE <-> SUSPENDED
   * - ACTIVE -> RETIRED
   * - SUSPENDED -> RETIRED
   * - RETIRED is a terminal state and cannot transition to any other status.
   */
  async transitionStatus(deviceId: string, newStatus: DeviceStatus): Promise<Device> {
    const device = await this.getDeviceById(deviceId);

    if (device.status === newStatus) {
      return device;
    }

    if (device.status === DeviceStatus.RETIRED) {
      throw new BadRequestException(
        `Device '${deviceId}' is RETIRED. RETIRED is a terminal lifecycle state and cannot be changed.`
      );
    }

    return this.devicesRepository.updateStatus(deviceId, newStatus);
  }

  /**
   * Records a heartbeat for an active or suspended device.
   * Throws if the device is RETIRED.
   */
  async recordHeartbeat(deviceId: string): Promise<Device> {
    const device = await this.getDeviceById(deviceId);

    if (device.status === DeviceStatus.RETIRED) {
      throw new BadRequestException(`Cannot record heartbeat for a RETIRED device ('${deviceId}')`);
    }

    return this.devicesRepository.updateLastSeen(deviceId);
  }

  /**
   * Validates whether a device is currently operational:
   * - Device exists and is in ACTIVE status.
   * - Associated branch is in ACTIVE status.
   * - Associated organization is in ACTIVE status.
   */
  async validateDeviceOperational(deviceId: string): Promise<DeviceWithRelations> {
    const device = await this.getDeviceById(deviceId);

    if (device.status !== DeviceStatus.ACTIVE) {
      throw new BadRequestException(
        `Device '${deviceId}' is not in ACTIVE status (current: ${device.status})`
      );
    }

    if (device.branch.status !== BranchStatus.ACTIVE) {
      throw new BadRequestException(
        `Branch '${device.branchId}' for device '${deviceId}' is not in ACTIVE status (current: ${device.branch.status})`
      );
    }

    if (device.organization.status !== OrganizationStatus.ACTIVE) {
      throw new BadRequestException(
        `Organization '${device.organizationId}' for device '${deviceId}' is not in ACTIVE status (current: ${device.organization.status})`
      );
    }

    return device;
  }
}
