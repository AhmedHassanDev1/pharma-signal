import { DatabaseClassification } from '../enums/database-classification.enum.js';

export interface ProfileEvidence {
  matchedPatterns?: string[];
  sampleValues?: Record<string, unknown>;
  matchedColumns?: string[];
  heuristicScores?: Record<string, number>;
}

export interface ProfileSnapshot {
  id: string;
  dataSourceId: string;
  schemaFingerprint: string;
  classification: DatabaseClassification;
  confidence: number;
  evidence: ProfileEvidence;
  reason: string;
  createdAt: string;
}
