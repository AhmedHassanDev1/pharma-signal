import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { DeviceCredentialService } from '../enrollment/device-credential.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus
} from '@prisma/client';
import {
  RegisterDataSourceRequestDto,
  UploadProfileSnapshotRequestDto,
  TableSchema,
  DatabaseClassification as ContractClassification
} from '@pharma-signal/contracts';
import { computeSchemaFingerprint } from '../schemas/schema-fingerprint.util.js';

describe('M3 Data Source, Schema & Profile Full Lifecycle Integration (AHM-298)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deviceCredentialService: DeviceCredentialService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    prisma = app.get<PrismaService>(PrismaService);
    deviceCredentialService = app.get<DeviceCredentialService>(DeviceCredentialService);

    await app.init();
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? address : address.port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should execute full M3 lifecycle: register -> idempotency -> schema v1 -> immutable check -> schema v2 -> profile linkage -> auth isolation', async () => {
    // 1. Setup Tenant & Device
    const org = await prisma.organization.create({
      data: {
        name: 'M3 Lifecycle Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'M3 Main Branch',
        code: `M3-BR-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device1 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'M3-POS-01',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });

    const device1Token = deviceCredentialService.generateDeviceToken({
      sub: device1.id,
      deviceId: device1.id,
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId: device1.agentInstanceId
    });

    // 2. Register DataSource (POST /api/v1/agent/data-sources)
    const dsPayload: RegisterDataSourceRequestDto = {
      localDataSourceKey: 'sqlite-pos-main',
      engine: 'SQLite',
      databaseName: 'pos.db',
      declaredSoftwareName: 'eStock',
      detectedSoftwareName: 'eStock'
    };

    const dsRes1 = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify(dsPayload)
    });
    expect(dsRes1.status).toBe(201);
    const ds1 = (await dsRes1.json()) as any;
    expect(ds1.dataSourceId).toBeDefined();
    expect(ds1.deviceId).toBe(device1.id);
    expect(ds1.detectionStatus).toBe('MATCH');

    // 3. Registration Idempotency Check: same device + same local key returns same DataSource
    const dsResDuplicate = await fetch(`${baseUrl}/agent/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify(dsPayload)
    });
    expect(dsResDuplicate.status).toBe(201);
    const ds1Duplicate = (await dsResDuplicate.json()) as any;
    expect(ds1Duplicate.dataSourceId).toBe(ds1.dataSourceId);

    // 4. Schema Snapshot Upload v1 (POST /api/v1/agent/schemas)
    const tablesV1: TableSchema[] = [
      {
        name: 'inventory_items',
        columns: [
          { name: 'sku', dataType: 'TEXT', isNullable: false, isPrimaryKey: true },
          { name: 'name', dataType: 'TEXT', isNullable: false, isPrimaryKey: false },
          { name: 'quantity', dataType: 'INTEGER', isNullable: false, isPrimaryKey: false }
        ],
        primaryKey: ['sku']
      }
    ];
    const fingerprintV1 = computeSchemaFingerprint(tablesV1);

    const schemaRes1 = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify({
        dataSourceId: ds1.dataSourceId,
        schemaFingerprint: fingerprintV1,
        tables: tablesV1
      })
    });
    expect(schemaRes1.status).toBe(201);
    const schema1 = (await schemaRes1.json()) as any;
    expect(schema1.snapshotId).toBeDefined();
    expect(schema1.version).toBe(1);
    expect(schema1.isNewVersion).toBe(true);

    // 5. Snapshot Immutability Check: re-uploading identical schema returns existing snapshot
    const schemaRes1Duplicate = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify({
        dataSourceId: ds1.dataSourceId,
        schemaFingerprint: fingerprintV1,
        tables: tablesV1
      })
    });
    expect(schemaRes1Duplicate.status).toBe(201);
    const schema1Duplicate = (await schemaRes1Duplicate.json()) as any;
    expect(schema1Duplicate.snapshotId).toBe(schema1.snapshotId);
    expect(schema1Duplicate.version).toBe(1);
    expect(schema1Duplicate.isNewVersion).toBe(false);

    // 6. Schema Fingerprint Changes: upload evolved schema v2
    const tablesV2: TableSchema[] = [
      ...tablesV1,
      {
        name: 'sales_transactions',
        columns: [
          { name: 'id', dataType: 'TEXT', isNullable: false, isPrimaryKey: true },
          { name: 'sku', dataType: 'TEXT', isNullable: false, isPrimaryKey: false },
          { name: 'amount', dataType: 'REAL', isNullable: false, isPrimaryKey: false }
        ],
        primaryKey: ['id']
      }
    ];
    const fingerprintV2 = computeSchemaFingerprint(tablesV2);
    expect(fingerprintV2).not.toBe(fingerprintV1);

    const schemaRes2 = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify({
        dataSourceId: ds1.dataSourceId,
        schemaFingerprint: fingerprintV2,
        tables: tablesV2
      })
    });
    expect(schemaRes2.status).toBe(201);
    const schema2 = (await schemaRes2.json()) as any;
    expect(schema2.snapshotId).not.toBe(schema1.snapshotId);
    expect(schema2.version).toBe(2);
    expect(schema2.isNewVersion).toBe(true);

    // 7. Profile Linkage Failure: Uploading profile with unregistered schema fingerprint fails
    const fakeFingerprint = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const profileFailRes = await fetch(`${baseUrl}/agent/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify({
        dataSourceId: ds1.dataSourceId,
        schemaFingerprint: fakeFingerprint,
        classification: ContractClassification.SQLITE,
        confidence: 0.99,
        evidence: { matchedColumns: ['sku'] },
        reason: 'Attempt with non-matching fingerprint'
      })
    });
    expect(profileFailRes.status).toBe(400);

    // 8. Profile Linkage Success: Uploading profile linked to schema v2 fingerprint
    const profilePayload: UploadProfileSnapshotRequestDto = {
      dataSourceId: ds1.dataSourceId,
      schemaFingerprint: fingerprintV2,
      classification: ContractClassification.SQLITE,
      confidence: 0.97,
      evidence: {
        matchedColumns: ['sku', 'name', 'quantity', 'amount'],
        matchedPatterns: ['sqlite_master']
      },
      reason: 'Confirmed SQLite POS structure with v2 transaction tables'
    };

    const profileRes = await fetch(`${baseUrl}/agent/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify(profilePayload)
    });
    expect(profileRes.status).toBe(201);
    const profileBody = (await profileRes.json()) as any;
    expect(profileBody.profileSnapshotId).toBeDefined();
    expect(profileBody.dataSourceId).toBe(ds1.dataSourceId);
    expect(profileBody.schemaFingerprint).toBe(fingerprintV2);
    expect(profileBody.classification).toBe(ContractClassification.SQLITE);

    // 9. Verify Latest Retrieval for Schema and Profile
    const latestSchemaRes = await fetch(
      `${baseUrl}/agent/data-sources/${ds1.dataSourceId}/schemas/latest`,
      { headers: { Authorization: `Bearer ${device1Token}` } }
    );
    expect(latestSchemaRes.status).toBe(200);
    const latestSchema = (await latestSchemaRes.json()) as any;
    expect(latestSchema.id).toBe(schema2.snapshotId);
    expect(latestSchema.version).toBe(2);

    const latestProfileRes = await fetch(
      `${baseUrl}/agent/data-sources/${ds1.dataSourceId}/profiles/latest`,
      { headers: { Authorization: `Bearer ${device1Token}` } }
    );
    expect(latestProfileRes.status).toBe(200);
    const latestProfile = (await latestProfileRes.json()) as any;
    expect(latestProfile.id).toBe(profileBody.profileSnapshotId);
    expect(latestProfile.schemaFingerprint).toBe(fingerprintV2);

    // 10. Authorization & Cross-Device Isolation: Device 2 cannot access Device 1's resources
    const device2 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'M3-POS-02',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });
    const device2Token = deviceCredentialService.generateDeviceToken({
      sub: device2.id,
      deviceId: device2.id,
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId: device2.agentInstanceId
    });

    // Device 2 attempts to upload schema for Device 1's dataSource
    const forbiddenSchema = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device2Token}`
      },
      body: JSON.stringify({
        dataSourceId: ds1.dataSourceId,
        schemaFingerprint: fingerprintV1,
        tables: tablesV1
      })
    });
    expect(forbiddenSchema.status).toBe(403);

    // Device 2 attempts to upload profile for Device 1's dataSource
    const forbiddenProfile = await fetch(`${baseUrl}/agent/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device2Token}`
      },
      body: JSON.stringify(profilePayload)
    });
    expect(forbiddenProfile.status).toBe(403);

    // Device 2 attempts to get Device 1's profile
    const forbiddenGetProfile = await fetch(
      `${baseUrl}/agent/profiles/${profileBody.profileSnapshotId}`,
      { headers: { Authorization: `Bearer ${device2Token}` } }
    );
    expect(forbiddenGetProfile.status).toBe(403);

    // Cleanup: Cascade delete on org
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
