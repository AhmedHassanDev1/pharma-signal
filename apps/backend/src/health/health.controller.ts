import { Controller, Get } from '@nestjs/common';
import { CURRENT_API_VERSION } from '@pharma-signal/config';

export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  version: string;
  service: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: CURRENT_API_VERSION,
      service: 'pharma-signal-backend'
    };
  }
}
