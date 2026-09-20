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
  DetectionStatus,
  DatabaseClassification
} from '@prisma/client';
import {
  UploadProfileSnapshotRequestDto,
  DatabaseClassification as ContractClassification
} from '@pharma-signal/contracts';

describe('Profile Snapshots Integration API (POST /api/v1/agent/profiles)', () => {
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

  it('should ingest profile snapshots, validate against schema fingerprint, store classification/evidence/reason, and enforce authorization', async () => {
    // 1. Setup Org, Branch, Device 1, DataSource 1
    const org = await prisma.organization.create({
      data: {
        name: 'Profile Test Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Profile Test Branch',
        code: `PROF-BR-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device1 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'PROFILE-POS-1',
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
        localDataSourceKey: 'sqlite-profile-db',
        engine: 'SQLite',
        databaseName: 'pharmacy.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    const validFingerprint = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    // Create a SchemaSnapshot for dataSource1 with validFingerprint
    await prisma.schemaSnapshot.create({
      data: {
        dataSourceId: dataSource1.id,
        schemaFingerprint: validFingerprint,
        version: 1,
        tables: [{ name: 'items' }, { name: 'sales' }, { name: 'inventory' }]
      }
    });

    // 2. Test Ingestion with invalid schemaFingerprint -> 400 Bad Request
    const invalidFpPayload: UploadProfileSnapshotRequestDto = {
      dataSourceId: dataSource1.id,
      schemaFingerprint: 'nonexistent1234nonexistent1234nonexistent1234nonexistent1234non',
      classification: ContractClassification.SQLITE,
      confidence: 0.95,
      evidence: { matchedColumns: ['items'] },
      reason: 'Partial match'
    };

    const invalidFpRes = await fetch(`${baseUrl}/agent/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify(invalidFpPayload)
    });
    expect(invalidFpRes.status).toBe(400);

    // 3. Test Ingestion without auth -> 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}/agent/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...invalidFpPayload,
        schemaFingerprint: validFingerprint
      })
    });
    expect(unauthRes.status).toBe(401);

    // 4. Test Ingestion from a different device -> 403 Forbidden
    const device2 = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'PROFILE-POS-2',
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

    const forbiddenRes = await fetch(`${baseUrl}/agent/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device2Token}`
      },
      body: JSON.stringify({
        dataSourceId: dataSource1.id,
        schemaFingerprint: validFingerprint,
        classification: ContractClassification.SQLITE,
        confidence: 0.95,
        evidence: { matchedColumns: ['items'] },
        reason: 'Attempt from another device'
      })
    });
    expect(forbiddenRes.status).toBe(403);

    // 5. Test Successful Ingestion via POST /api/v1/agent/profiles
    const validPayload: UploadProfileSnapshotRequestDto = {
      dataSourceId: dataSource1.id,
      schemaFingerprint: validFingerprint,
      classification: ContractClassification.SQLITE,
      confidence: 0.98,
      evidence: {
        matchedColumns: ['items', 'sales', 'inventory'],
        matchedPatterns: ['sqlite_%']
      },
      reason: 'Exact column match with SQLite schema definition'
    };

    const successRes = await fetch(`${baseUrl}/agent/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify(validPayload)
    });

    expect(successRes.status).toBe(201);
    const createdProfile = await successRes.json();
    expect(createdProfile).toMatchObject({
      dataSourceId: dataSource1.id,
      schemaFingerprint: validFingerprint,
      classification: ContractClassification.SQLITE,
      confidence: 0.98
    });
    expect(createdProfile.profileSnapshotId).toBeDefined();

    // Verify in DB directly
    const dbProfile = await prisma.profileSnapshot.findUnique({
      where: { id: createdProfile.profileSnapshotId }
    });
    expect(dbProfile).not.toBeNull();
    expect(dbProfile?.classification).toBe(DatabaseClassification.SQLITE);
    expect(dbProfile?.confidence).toBe(0.98);
    expect(dbProfile?.evidence).toEqual(validPayload.evidence);
    expect(dbProfile?.reason).toBe(validPayload.reason);

    // 6. Test retrieval via GET /api/v1/agent/profiles/:id
    const getRes = await fetch(`${baseUrl}/agent/profiles/${createdProfile.profileSnapshotId}`, {
      headers: { Authorization: `Bearer ${device1Token}` }
    });
    expect(getRes.status).toBe(200);
    const retrieved = await getRes.json();
    expect(retrieved.id).toBe(createdProfile.profileSnapshotId);
    expect(retrieved.reason).toBe(validPayload.reason);

    // Cross-device retrieval should be 403 Forbidden
    const crossGetRes = await fetch(`${baseUrl}/agent/profiles/${createdProfile.profileSnapshotId}`, {
      headers: { Authorization: `Bearer ${device2Token}` }
    });
    expect(crossGetRes.status).toBe(403);

    // 7. Test retrieval via GET /api/v1/agent/data-sources/:dataSourceId/profiles/latest
    const latestRes = await fetch(`${baseUrl}/agent/data-sources/${dataSource1.id}/profiles/latest`, {
      headers: { Authorization: `Bearer ${device1Token}` }
    });
    expect(latestRes.status).toBe(200);
    const latest = await latestRes.json();
    expect(latest.id).toBe(createdProfile.profileSnapshotId);

    // 8. Test Ingestion via alias POST /api/v1/agent/profile-snapshots
    const aliasRes = await fetch(`${baseUrl}/agent/profile-snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${device1Token}`
      },
      body: JSON.stringify(validPayload)
    });
    expect(aliasRes.status).toBe(201);
  });
});
