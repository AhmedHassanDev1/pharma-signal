export interface InvalidParamDetail {
  name: string;
  reason: string;
}

/**
 * RFC 7807 Problem Details representation
 */
export interface ApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  invalidParams?: InvalidParamDetail[];
  timestamp?: string;
  [key: string]: unknown;
}
