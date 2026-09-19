import { DatabaseClassification } from '../enums/database-classification.enum.js';
import { ProfileEvidence } from '../entities/profile-snapshot.interface.js';

export interface UploadProfileSnapshotRequestDto {
  dataSourceId: string;
  schemaFingerprint: string;
  classification: DatabaseClassification;
  confidence: number;
  evidence: ProfileEvidence;
  reason: string;
}

export interface UploadProfileSnapshotResponseDto {
  profileSnapshotId: string;
  dataSourceId: string;
  schemaFingerprint: string;
  classification: DatabaseClassification;
  confidence: number;
}
