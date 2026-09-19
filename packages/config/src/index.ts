/**
 * Shared Non-Sensitive Configuration and Constants
 *
 * CRITICAL RULE:
 * NEVER place secrets, private keys, database passwords, or credentials here.
 * Only public constants, default ports, route prefixes, and non-sensitive limits.
 */

export const API_V1_PREFIX = '/api/v1';
export const CURRENT_API_VERSION = 'v1';

export const DEFAULT_PORTS = {
  BACKEND: 3000,
  FRONTEND: 3001,
  POSTGRES: 5432
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100
} as const;

export const INGESTION_LIMITS = {
  MAX_BATCH_RECORDS: 5000,
  MAX_PAYLOAD_SIZE_BYTES: 10 * 1024 * 1024 // 10MB
} as const;

export const TIME_FORMATS = {
  ISO_UTC: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
} as const;
