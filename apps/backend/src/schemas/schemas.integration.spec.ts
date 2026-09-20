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
  DeviceStatus,
  DetectionStatus
} from '@prisma/client';
import {
  UploadSchemaSnapshotRequestDto,
  TableSchema
} from '@pharma-signal/contracts';
import { computeSchemaFingerprint } from './schema-fingerprint.util.js';

describe('Schema Snapshots Integration & Storage API (POST /api/v1/agent/schemas)', () => {
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

  it('should store immutable SchemaSnapshots, handle idempotency, version progression, and enforce authorization', async () => {
    // 1. Setup Organization, Branch, Device, and DataSource
    const org = await prisma.organization.create({
      data: {
        name: 'Schema Test Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Schema Test Branch',
        code: `SCH-BR-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const agentInstanceId1 = randomUUID();
    const device1 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: agentInstanceId1,
        hostname: 'SCHEMA-POS-1',
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

    const dataSource1 = await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device1.id,
        localDataSourceKey: 'sqlite-schema-db',
        engine: 'SQLite',
        databaseName: 'pharmacy.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    // 2. Define schema v1 tables
    const tablesV1: TableSchema[] = [
      {
        name: 'products',
        columns: [
          { name: 'id', dataType: 'UUID', isNullable: false, isPrimaryKey: true },
          { name: 'name', dataType: 'VARCHAR', isNullable: false, isPrimaryKey: false, maxLength: 255 },
          { name: 'price', dataType: 'NUMERIC', isNullable: true, isPrimaryKey: false }
        ],
        primaryKey: ['id'],
        indexes: [{ name: 'idx_products_name', columns: ['name'], isUnique: false }]
      }
    ];
    const fingerprintV1 = computeSchemaFingerprint(tablesV1);

    // 3. Test unauthenticated request (must return 401)
    const unauthRes = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataSourceId: dataSource1.id,
        schemaFingerprint: fingerprintV1,
        tables: tablesV1
      })
    });
    expect(unauthRes.status).toBe(401);

    // 4. Upload initial schema snapshot (v1)
    const uploadV1Payload: UploadSchemaSnapshotRequestDto = {
      dataSourceId: dataSource1.id,
      schemaFingerprint: fingerprintV1,
      tables: tablesV1
    };

    const resV1 = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify(uploadV1Payload)
    });

    expect(resV1.status).toBe(201);
    const bodyV1 = (await resV1.json()) as any;
    expect(bodyV1.snapshotId).toBeDefined();
    expect(bodyV1.dataSourceId).toBe(dataSource1.id);
    expect(bodyV1.schemaFingerprint).toBe(fingerprintV1);
    expect(bodyV1.version).toBe(1);
    expect(bodyV1.isNewVersion).toBe(true);

    // Verify record in PostgreSQL database
    const dbSnapshotV1 = await prisma.schemaSnapshot.findUnique({
      where: { id: bodyV1.snapshotId }
    });
    expect(dbSnapshotV1).not.toBeNull();
    expect(dbSnapshotV1?.version).toBe(1);
    expect(dbSnapshotV1?.schemaFingerprint).toBe(fingerprintV1);

    // 5. Re-upload identical schema snapshot (Idempotency & Immutability test)
    const resV1Duplicate = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify(uploadV1Payload)
    });

    expect(resV1Duplicate.status).toBe(201);
    const bodyV1Duplicate = (await resV1Duplicate.json()) as any;
    expect(bodyV1Duplicate.snapshotId).toBe(bodyV1.snapshotId); // Exact same snapshot
    expect(bodyV1Duplicate.version).toBe(1);
    expect(bodyV1Duplicate.isNewVersion).toBe(false); // Not a new version!

    // 6. Upload schema v2 (added batches table -> new fingerprint)
    const tablesV2: TableSchema[] = [
      ...tablesV1,
      {
        name: 'batches',
        columns: [
          { name: 'id', dataType: 'UUID', isNullable: false, isPrimaryKey: true },
          { name: 'product_id', dataType: 'UUID', isNullable: false, isPrimaryKey: false },
          { name: 'quantity', dataType: 'INT', isNullable: false, isPrimaryKey: false }
        ],
        primaryKey: ['id'],
        foreignKeys: [
          { columnName: 'product_id', referencedTable: 'products', referencedColumn: 'id' }
        ]
      }
    ];
    const fingerprintV2 = computeSchemaFingerprint(tablesV2);
    expect(fingerprintV2).not.toBe(fingerprintV1);

    const resV2 = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify({
        dataSourceId: dataSource1.id,
        schemaFingerprint: fingerprintV2,
        tables: tablesV2
      })
    });

    expect(resV2.status).toBe(201);
    const bodyV2 = (await resV2.json()) as any;
    expect(bodyV2.snapshotId).toBeDefined();
    expect(bodyV2.snapshotId).not.toBe(bodyV1.snapshotId);
    expect(bodyV2.version).toBe(2);
    expect(bodyV2.isNewVersion).toBe(true);

    // Verify both snapshots exist in DB (immutability preserved)
    const allSnapshots = await prisma.schemaSnapshot.findMany({
      where: { dataSourceId: dataSource1.id },
      orderBy: { version: 'asc' }
    });
    expect(allSnapshots).toHaveLength(2);
    expect(allSnapshots[0]!.version).toBe(1);
    expect(allSnapshots[0]!.schemaFingerprint).toBe(fingerprintV1);
    expect(allSnapshots[1]!.version).toBe(2);
    expect(allSnapshots[1]!.schemaFingerprint).toBe(fingerprintV2);

    // 7. Test Retrieval Endpoints
    // 7a. Get Latest Schema Snapshot
    const latestRes = await fetch(`${baseUrl}/agent/data-sources/${dataSource1.id}/schemas/latest`, {
      headers: { Authorization: `Bearer ${device1Token}` }
    });
    expect(latestRes.status).toBe(200);
    const latestBody = (await latestRes.json()) as any;
    expect(latestBody.id).toBe(bodyV2.snapshotId);
    expect(latestBody.version).toBe(2);

    // 7b. Get Snapshot By ID
    const byIdRes = await fetch(`${baseUrl}/agent/schemas/${bodyV1.snapshotId}`, {
      headers: { Authorization: `Bearer ${device1Token}` }
    });
    expect(byIdRes.status).toBe(200);
    const byIdBody = (await byIdRes.json()) as any;
    expect(byIdBody.id).toBe(bodyV1.snapshotId);
    expect(byIdBody.version).toBe(1);

    // 8. Test Device / Tenant Isolation: Device 2 trying to upload schema for Device 1's dataSource
    const device2 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'SCHEMA-POS-2',
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

    const forbiddenRes = await fetch(`${baseUrl}/agent/schemas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device2Token}`
      },
      body: JSON.stringify({
        dataSourceId: dataSource1.id,
        schemaFingerprint: fingerprintV1,
        tables: tablesV1
      })
    });
    expect(forbiddenRes.status).toBe(403);

    // Cleanup: Cascade delete on organization cleans up branches, devices, dataSources, schemaSnapshots
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
