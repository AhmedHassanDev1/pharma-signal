import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { ProfileSnapshot, DatabaseClassification } from '@prisma/client';
import { ProfileEvidence } from '@pharma-signal/contracts';

export interface CreateProfileSnapshotInput {
  dataSourceId: string;
  schemaFingerprint: string;
  classification: DatabaseClassification;
  confidence: number;
  evidence: ProfileEvidence;
  reason: string;
}

@Injectable()
export class ProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProfileSnapshot | null> {
    return this.prisma.profileSnapshot.findUnique({
      where: { id }
    });
  }

  async findByDataSource(dataSourceId: string): Promise<ProfileSnapshot[]> {
    return this.prisma.profileSnapshot.findMany({
      where: { dataSourceId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findLatestByDataSource(dataSourceId: string): Promise<ProfileSnapshot | null> {
    return this.prisma.profileSnapshot.findFirst({
      where: { dataSourceId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: CreateProfileSnapshotInput): Promise<ProfileSnapshot> {
    return this.prisma.profileSnapshot.create({
      data: {
        dataSourceId: data.dataSourceId,
        schemaFingerprint: data.schemaFingerprint,
        classification: data.classification,
        confidence: data.confidence,
        evidence: data.evidence as unknown as object,
        reason: data.reason
      }
    });
  }
}
