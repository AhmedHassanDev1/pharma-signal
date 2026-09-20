import { Controller, Get } from '@nestjs/common';
import { PlatformService } from './platform.service.js';
import { PlatformOverviewDto } from '@pharma-signal/contracts';

@Controller()
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('platform/overview')
  async getPlatformOverview(): Promise<PlatformOverviewDto> {
    return this.platformService.getOverview();
  }

  @Get('dashboard/overview')
  async getDashboardOverview(): Promise<PlatformOverviewDto> {
    return this.platformService.getOverview();
  }
}
