import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { DevicesService } from './devices.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Devices & Organizations Domain Integration Tests', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let devicesService: DevicesService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, OrganizationsModule, DevicesModule]
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    devicesService = moduleRef.get<DevicesService>(DevicesService);

    await prisma.onModuleInit();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('should establish Organization -> Branch -> Device hierarchy and enforce server-side ownership and lifecycle', async () => {
    // 1. Create Organization
    const org = await prisma.organization.create({
      data: {
        name: 'Integration Dev Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    // 2. Create Branch
    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Dev Branch Alpha',
        code: 'DEV-INT-ALPHA',
        status: BranchStatus.ACTIVE
      }
    });

    const agentInstanceId = '33333333-4444-5555-6666-777777777777';

    // 3. Register Device through DevicesService (server-side ownership check)
    const device = await devicesService.registerDevice({
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId,
      hostname: 'INTEGRATION-POS-1',
      os: 'Windows 11 Pro',
      appVersion: '0.1.0'
    });

    expect(device.id).toBeDefined();
    expect(device.organizationId).toBe(org.id);
    expect(device.branchId).toBe(branch.id);
    expect(device.agentInstanceId).toBe(agentInstanceId);
    expect(device.status).toBe(DeviceStatus.ACTIVE);

    // 4. Retrieve with relations
    const retrieved = await devicesService.getDeviceById(device.id);
    expect(retrieved.organization.name).toBe('Integration Dev Pharmacy');
    expect(retrieved.branch.name).toBe('Dev Branch Alpha');

    // 5. Lookup by agentInstanceId
    const byAgent = await devicesService.getDeviceByAgentInstanceId(agentInstanceId);
    expect(byAgent?.id).toBe(device.id);

    // 6. Validate operational check when ACTIVE
    const operational = await devicesService.validateDeviceOperational(device.id);
    expect(operational.id).toBe(device.id);

    // 7. Status transitions: ACTIVE -> SUSPENDED
    const suspended = await devicesService.transitionStatus(device.id, DeviceStatus.SUSPENDED);
    expect(suspended.status).toBe(DeviceStatus.SUSPENDED);

    // Operational check must fail when SUSPENDED
    await expect(devicesService.validateDeviceOperational(device.id)).rejects.toThrow(BadRequestException);

    // Re-activate: SUSPENDED -> ACTIVE
    const reactivated = await devicesService.transitionStatus(device.id, DeviceStatus.ACTIVE);
    expect(reactivated.status).toBe(DeviceStatus.ACTIVE);

    // 8. Record heartbeat
    const heartbeatDevice = await devicesService.recordHeartbeat(device.id);
    expect(heartbeatDevice.lastSeenAt).toBeDefined();

    // 9. Status transition: ACTIVE -> RETIRED (terminal state)
    const retired = await devicesService.transitionStatus(device.id, DeviceStatus.RETIRED);
    expect(retired.status).toBe(DeviceStatus.RETIRED);

    // Transition from RETIRED must be rejected
    await expect(devicesService.transitionStatus(device.id, DeviceStatus.ACTIVE)).rejects.toThrow(BadRequestException);

    // Heartbeat on RETIRED device must be rejected
    await expect(devicesService.recordHeartbeat(device.id)).rejects.toThrow(BadRequestException);

    // 10. Re-registering with same agentInstanceId when RETIRED must be rejected
    await expect(
      devicesService.registerDevice({
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId,
        hostname: 'INTEGRATION-POS-RETRY',
        os: 'Windows 11 Pro',
        appVersion: '0.1.0'
      })
    ).rejects.toThrow(BadRequestException);

    // Cleanup: Cascade delete from organization cleans up branches and devices
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('should reject device registration if branch belongs to a different organization', async () => {
    // Org 1 + Branch 1
    const org1 = await prisma.organization.create({
      data: {
        name: 'Org One',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });
    const branch1 = await prisma.branch.create({
      data: {
        organizationId: org1.id,
        name: 'Branch One',
        status: BranchStatus.ACTIVE
      }
    });

    // Org 2
    const org2 = await prisma.organization.create({
      data: {
        name: 'Org Two',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    // Attempt to register device with org2 but branch1 (which belongs to org1)
    await expect(
      devicesService.registerDevice({
        organizationId: org2.id,
        branchId: branch1.id,
        agentInstanceId: '44444444-5555-6666-7777-888888888888',
        hostname: 'SPOOFED-POS',
        os: 'Windows 11',
        appVersion: '0.1.0'
      })
    ).rejects.toThrow(BadRequestException);

    // Cleanup
    await prisma.organization.delete({ where: { id: org1.id } });
    await prisma.organization.delete({ where: { id: org2.id } });
  });
});
