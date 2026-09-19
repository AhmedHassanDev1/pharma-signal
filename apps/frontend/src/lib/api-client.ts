import { API_V1_PREFIX, DEFAULT_PORTS } from '@pharma-signal/config';
import { ApiProblemDetails } from '@pharma-signal/contracts';

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  service: string;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public problem?: ApiProblemDetails,
    message?: string
  ) {
    super(message || problem?.detail || `API error with status ${status}`);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
      `http://localhost:${DEFAULT_PORTS.BACKEND}${API_V1_PREFIX}`;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      const problem = await res.json().catch(() => undefined);
      throw new ApiClientError(res.status, problem);
    }

    return res.json();
  }
}

export const apiClient = new ApiClient();
