import { PrismaClient, OrganizationRole, OrganizationStatus, BranchStatus, DeviceStatus, DetectionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed for development...');

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Ahmed Pharma Group',
      role: OrganizationRole.RETAIL_PHARMACY,
      status: OrganizationStatus.ACTIVE
    }
  });
  console.log(`[Seed] Created Organization: ${org.name} (${org.id})`);

  // 2. Create Branches
  const mainBranch = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Main Branch - Cairo',
      code: 'CAI-01',
      status: BranchStatus.ACTIVE
    }
  });

  const secondBranch = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: 'Alexandria Branch',
      code: 'ALX-01',
      status: BranchStatus.ACTIVE
    }
  });
  console.log(`[Seed] Created Branches: ${mainBranch.name}, ${secondBranch.name}`);

  // 3. Create Device on Main Branch
  const device = await prisma.device.create({
    data: {
      organizationId: org.id,
      branchId: mainBranch.id,
      agentInstanceId: 'e4d3c2b1-a0f9-8e7d-6c5b-4a3b2c1d0e9f',
      hostname: 'PHARMA-POS-01',
      os: 'Windows 11 Pro 64-bit',
      appVersion: '0.1.0',
      status: DeviceStatus.ACTIVE
    }
  });
  console.log(`[Seed] Created Device: ${device.hostname} (${device.id})`);

  // 4. Create DataSource on Main Branch with Software Match
  const dataSource = await prisma.dataSource.create({
    data: {
      organizationId: org.id,
      branchId: mainBranch.id,
      deviceId: device.id,
      localDataSourceKey: 'sqlite-pos-main-db-key',
      engine: 'SQLite',
      databaseName: 'PharmacyDB.db',
      declaredSoftwareName: 'eStock',
      detectedSoftwareName: 'eStock',
      detectionStatus: DetectionStatus.MATCH,
      status: 'ACTIVE'
    }
  });
  console.log(`[Seed] Created DataSource: ${dataSource.databaseName} [${dataSource.detectionStatus}]`);

  console.log('[Seed] Development seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
