import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { SchemaSnapshot } from '@prisma/client';
import { TableSchema } from '@pharma-signal/contracts';

export interface CreateSchemaSnapshotInput {
  dataSourceId: string;
  schemaFingerprint: string;
  tables: TableSchema[];
  version: number;
}

@Injectable()
export class SchemasRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SchemaSnapshot | null> {
    return this.prisma.schemaSnapshot.findUnique({
      where: { id }
    });
  }

  async findByDataSourceAndFingerprint(
    dataSourceId: string,
    schemaFingerprint: string
  ): Promise<SchemaSnapshot | null> {
    return this.prisma.schemaSnapshot.findUnique({
      where: {
        dataSourceId_schemaFingerprint: {
          dataSourceId,
          schemaFingerprint
        }
      }
    });
  }

  async findLatestByDataSource(dataSourceId: string): Promise<SchemaSnapshot | null> {
    return this.prisma.schemaSnapshot.findFirst({
      where: { dataSourceId },
      orderBy: { version: 'desc' }
    });
  }

  async create(data: CreateSchemaSnapshotInput): Promise<SchemaSnapshot> {
    return this.prisma.schemaSnapshot.create({
      data: {
        dataSourceId: data.dataSourceId,
        schemaFingerprint: data.schemaFingerprint,
        tables: data.tables as unknown as object,
        version: data.version
      }
    });
  }

  async findByDataSource(dataSourceId: string): Promise<SchemaSnapshot[]> {
    return this.prisma.schemaSnapshot.findMany({
      where: { dataSourceId },
      orderBy: { version: 'asc' }
    });
  }
}
