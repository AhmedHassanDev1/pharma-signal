import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service.js';
import { DatabaseModule } from './database.module.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus,
  DetectionStatus
} from '@prisma/client';

describe('Database Integration & Constraint Tests', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule]
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
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

  it('should verify database connectivity via isHealthy()', async () => {
    const isHealthy = await prisma.isHealthy();
    expect(isHealthy).toBe(true);
  });

  it('should successfully create Organization, Branch, Device, and DataSource with valid foreign keys', async () => {
    // 1. Create Organization
    const org = await prisma.organization.create({
      data: {
        name: 'Integration Test Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });
    expect(org.id).toBeDefined();

    // 2. Create Branch linked to Organization
    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Test Branch Alpha',
        code: `INT-ALPHA-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });
    expect(branch.organizationId).toBe(org.id);

    // 3. Create Device linked to Organization and Branch
    const agentInstanceId = randomUUID();
    const device = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId,
        hostname: 'INT-TEST-PC',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });
    expect(device.organizationId).toBe(org.id);
    expect(device.branchId).toBe(branch.id);

    // 4. Create DataSource linked to Organization, Branch, and Device
    const dataSource = await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device.id,
        localDataSourceKey: 'int-test-local-key',
        engine: 'SQLite',
        databaseName: 'IntTestDB.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });
    expect(dataSource.organizationId).toBe(org.id);
    expect(dataSource.branchId).toBe(branch.id);
    expect(dataSource.deviceId).toBe(device.id);

    // Cleanup test records (cascade delete on organization cleans up all children)
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('should enforce foreign key constraint when branch references non-existent organization', async () => {
    const nonExistentOrgId = '00000000-0000-0000-0000-000000000000';

    await expect(
      prisma.branch.create({
        data: {
          organizationId: nonExistentOrgId,
          name: 'Invalid Branch',
          code: 'INV-01'
        }
      })
    ).rejects.toThrow();
  });

  it('should enforce unique constraint on agentInstanceId', async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Unique Test Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Unique Branch'
      }
    });

    const duplicateAgentId = randomUUID();

    // First device creation should succeed
    await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: duplicateAgentId,
        hostname: 'PC-1',
        os: 'Windows',
        appVersion: '0.1.0'
      }
    });

    // Second device with same agentInstanceId should fail unique constraint
    await expect(
      prisma.device.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          agentInstanceId: duplicateAgentId,
          hostname: 'PC-2',
          os: 'Windows',
          appVersion: '0.1.0'
        }
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('should enforce unique constraint on branch code per organization', async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Branch Code Test Org',
        role: OrganizationRole.RETAIL_PHARMACY
      }
    });

    await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Branch 1',
        code: 'SAME-CODE'
      }
    });

    // Duplicate code in same organization must fail
    await expect(
      prisma.branch.create({
        data: {
          organizationId: org.id,
          name: 'Branch 2',
          code: 'SAME-CODE'
        }
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
