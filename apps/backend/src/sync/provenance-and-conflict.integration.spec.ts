import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { DeviceCredentialService } from '../enrollment/device-credential.service.js';
import { ProblemDetailsFilter } from '../common/filters/problem-details.filter.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus,
  DetectionStatus
} from '@prisma/client';
import {
  CanonicalSyncRequestDto,
  ApiProblemDetails
} from '@pharma-signal/contracts';

describe('Provenance Validation & Timestamp Conflict Resolution Integration (AHM-303)', () => {
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
    app.useGlobalFilters(new ProblemDetailsFilter());

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

  it('should reject invalid/forged provenance with RFC 7807 Problem Details and enforce extracted_at conflict rule', async () => {
    // 1. Setup Org, Branch, Device, DataSource
    const org = await prisma.organization.create({
      data: {
        name: 'Conflict Test Pharmacy',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'Conflict Test Branch',
        code: `CONF-BR-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'CONF-POS',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });

    const deviceToken = deviceCredentialService.generateDeviceToken({
      sub: device.id,
      deviceId: device.id,
      organizationId: org.id,
      branchId: branch.id,
      agentInstanceId: device.agentInstanceId
    });

    const dataSource = await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device.id,
        localDataSourceKey: 'sqlite-conflict-db',
        engine: 'SQLite',
        databaseName: 'conflict_test.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    // 2. Test RFC 7807 Problem Details on forged provenance
    const forgedProvenancePayload: CanonicalSyncRequestDto = {
      dataSourceId: dataSource.id,
      syncBatchId: randomUUID(),
      products: [
        {
          sourceId: 'prod-forged',
          sourceTable: 'products',
          data: {
            sourceId: 'prod-forged',
            sourceTable: 'products',
            code: 'FORGED-1',
            name: 'Forged Drug',
            isActive: true
          },
          provenance: {
            tenantId: randomUUID(), // Forged tenant!
            deviceId: device.id,
            dataSourceId: dataSource.id,
            sourceTable: 'products',
            sourceId: 'prod-forged',
            extractedAt: new Date().toISOString()
          }
        }
      ]
    };

    const forgedRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify(forgedProvenancePayload)
    });

    expect(forgedRes.status).toBe(400);
    expect(forgedRes.headers.get('content-type')).toContain('application/problem+json');
    const problem = (await forgedRes.json()) as ApiProblemDetails;
    expect(problem.type).toBe('https://api.pharmasignal.com/errors/invalid-provenance');
    expect(problem.title).toBe('Invalid Provenance');
    expect(problem.status).toBe(400);
    expect(problem.invalidParams).toBeDefined();
    expect(problem.invalidParams?.length).toBeGreaterThan(0);
    expect(problem.invalidParams?.[0]?.name).toContain('provenance.tenantId');

    // 3. Test extracted_at conflict resolution rule
    const initialTime = new Date('2026-09-20T12:00:00.000Z');
    const newerTime = new Date('2026-09-20T14:00:00.000Z');
    const staleTime = new Date('2026-09-20T10:00:00.000Z');

    // 3a. Ingest Initial Product (V1 at 12:00)
    const initialSyncRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify({
        dataSourceId: dataSource.id,
        syncBatchId: randomUUID(),
        products: [
          {
            sourceId: 'prod-conflict-1',
            sourceTable: 'products',
            data: {
              sourceId: 'prod-conflict-1',
              sourceTable: 'products',
              code: 'DRUG-1',
              name: 'Drug V1 (12:00)',
              isActive: true
            },
            provenance: {
              tenantId: org.id,
              deviceId: device.id,
              dataSourceId: dataSource.id,
              sourceTable: 'products',
              sourceId: 'prod-conflict-1',
              extractedAt: initialTime.toISOString()
            }
          }
        ]
      })
    });
    expect(initialSyncRes.status).toBe(200);

    const productV1 = await prisma.canonicalProduct.findUnique({
      where: {
        tenantId_dataSourceId_sourceTable_sourceId: {
          tenantId: org.id,
          dataSourceId: dataSource.id,
          sourceTable: 'products',
          sourceId: 'prod-conflict-1'
        }
      }
    });
    expect(productV1?.name).toBe('Drug V1 (12:00)');

    // 3b. Ingest Newer Update (V2 at 14:00) -> Should update successfully
    const newerSyncRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify({
        dataSourceId: dataSource.id,
        syncBatchId: randomUUID(),
        products: [
          {
            sourceId: 'prod-conflict-1',
            sourceTable: 'products',
            data: {
              sourceId: 'prod-conflict-1',
              sourceTable: 'products',
              code: 'DRUG-1',
              name: 'Drug V2 (14:00)',
              isActive: true
            },
            provenance: {
              tenantId: org.id,
              deviceId: device.id,
              dataSourceId: dataSource.id,
              sourceTable: 'products',
              sourceId: 'prod-conflict-1',
              extractedAt: newerTime.toISOString()
            }
          }
        ]
      })
    });
    expect(newerSyncRes.status).toBe(200);

    const productV2 = await prisma.canonicalProduct.findUnique({
      where: {
        tenantId_dataSourceId_sourceTable_sourceId: {
          tenantId: org.id,
          dataSourceId: dataSource.id,
          sourceTable: 'products',
          sourceId: 'prod-conflict-1'
        }
      }
    });
    expect(productV2?.name).toBe('Drug V2 (14:00)');

    // 3c. Ingest Stale Update (V0 at 10:00) -> Must NOT overwrite V2!
    const staleSyncRes = await fetch(`${baseUrl}/agent/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`
      },
      body: JSON.stringify({
        dataSourceId: dataSource.id,
        syncBatchId: randomUUID(),
        products: [
          {
            sourceId: 'prod-conflict-1',
            sourceTable: 'products',
            data: {
              sourceId: 'prod-conflict-1',
              sourceTable: 'products',
              code: 'DRUG-1',
              name: 'Drug Stale (10:00)',
              isActive: true
            },
            provenance: {
              tenantId: org.id,
              deviceId: device.id,
              dataSourceId: dataSource.id,
              sourceTable: 'products',
              sourceId: 'prod-conflict-1',
              extractedAt: staleTime.toISOString()
            }
          }
        ]
      })
    });
    expect(staleSyncRes.status).toBe(200);

    const productAfterStale = await prisma.canonicalProduct.findUnique({
      where: {
        tenantId_dataSourceId_sourceTable_sourceId: {
          tenantId: org.id,
          dataSourceId: dataSource.id,
          sourceTable: 'products',
          sourceId: 'prod-conflict-1'
        }
      }
    });
    // Verifies timestamp conflict resolution rule: newer data remains intact!
    expect(productAfterStale?.name).toBe('Drug V2 (14:00)');

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
