import { Controller, Get } from '@nestjs/common';
import { CURRENT_API_VERSION } from '@pharma-signal/config';
import { PrismaService } from '../database/prisma.service.js';

export interface HealthCheckResponse {
  status: 'ok';
  database: 'up' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  service: string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthCheckResponse> {
    const isDbHealthy = await this.prisma.isHealthy();

    return {
      status: 'ok',
      database: isDbHealthy ? 'up' : 'down',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: CURRENT_API_VERSION,
      service: 'pharma-signal-backend'
    };
  }
}
