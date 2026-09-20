import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  OrganizationRole,
  OrganizationStatus,
  BranchStatus,
  DeviceStatus,
  DetectionStatus
} from '@prisma/client';
import {
  DataSourceListItemDto,
  DataSourceDetailsDto,
  TableSchema
} from '@pharma-signal/contracts';

describe('Data Sources Management API (GET /api/v1/data-sources)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    prisma = app.get<PrismaService>(PrismaService);

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

  it('should list data sources and retrieve details with full schema snapshot', async () => {
    // 1. Setup Org, Branch, Device, DataSource, and SchemaSnapshot
    const org = await prisma.organization.create({
      data: {
        name: 'Schema Viewer Test Org',
        role: OrganizationRole.RETAIL_PHARMACY,
        status: OrganizationStatus.ACTIVE
      }
    });

    const branch = await prisma.branch.create({
      data: {
        organizationId: org.id,
        name: 'North Branch',
        code: `DS-B-${randomUUID().slice(0, 8)}`,
        status: BranchStatus.ACTIVE
      }
    });

    const device = await prisma.device.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        agentInstanceId: randomUUID(),
        hostname: 'DS-POS-01',
        os: 'Windows 11',
        appVersion: '0.1.0',
        status: DeviceStatus.ACTIVE
      }
    });

    const dataSource = await prisma.dataSource.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        deviceId: device.id,
        localDataSourceKey: 'sqlite-main-pos',
        engine: 'SQLite',
        databaseName: 'pos_main.db',
        declaredSoftwareName: 'eStock',
        detectedSoftwareName: 'eStock',
        detectionStatus: DetectionStatus.MATCH,
        status: 'ACTIVE'
      }
    });

    const testTables: TableSchema[] = [
      {
        name: 'products',
        primaryKey: ['id'],
        columns: [
          {
            name: 'id',
            dataType: 'INTEGER',
            isNullable: false,
            isPrimaryKey: true
          },
          {
            name: 'barcode',
            dataType: 'TEXT',
            isNullable: false,
            isPrimaryKey: false
          },
          {
            name: 'name',
            dataType: 'TEXT',
            isNullable: false,
            isPrimaryKey: false
          }
        ],
        indexes: [
          {
            name: 'idx_products_barcode',
            columns: ['barcode'],
            isUnique: true
          }
        ]
      }
    ];

    await prisma.schemaSnapshot.create({
      data: {
        dataSourceId: dataSource.id,
        schemaFingerprint: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
        tables: testTables as unknown as object,
        version: 1
      }
    });

    // 2. Query GET /api/v1/data-sources
    const listRes = await fetch(`${baseUrl}/data-sources`);
    expect(listRes.status).toBe(200);

    const list: DataSourceListItemDto[] = await listRes.json();
    expect(Array.isArray(list)).toBe(true);

    const found = list.find((d) => d.id === dataSource.id);
    expect(found).toBeDefined();
    expect(found?.databaseName).toBe('pos_main.db');
    expect(found?.engine).toBe('SQLite');
    expect(found?.deviceHostname).toBe('DS-POS-01');
    expect(found?.organizationName).toBe('Schema Viewer Test Org');
    expect(found?.latestSchemaVersion).toBe(1);
    expect(found?.tablesCount).toBe(1);

    // 3. Query GET /api/v1/data-sources/:id
    const detailRes = await fetch(`${baseUrl}/data-sources/${dataSource.id}`);
    expect(detailRes.status).toBe(200);

    const details: DataSourceDetailsDto = await detailRes.json();
    expect(details.id).toBe(dataSource.id);
    expect(details.latestSchema).toBeDefined();
    expect(details.latestSchema?.version).toBe(1);
    expect(details.latestSchema?.tables).toBeDefined();
    const firstTable = details.latestSchema!.tables[0];
    expect(firstTable.name).toBe('products');
    expect(firstTable.columns.length).toBe(3);
    expect(firstTable.columns[0].isPrimaryKey).toBe(true);
    expect(firstTable.indexes?.length).toBe(1);

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });
});
