import { Controller, Get, Param, Query } from '@nestjs/common';
import { DataSourcesService } from './data-sources.service.js';
import {
  DataSourceListItemDto,
  DataSourceDetailsDto
} from '@pharma-signal/contracts';

@Controller('data-sources')
export class DataSourcesManagementController {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  @Get()
  async listDataSources(@Query('limit') limit?: string): Promise<DataSourceListItemDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    return this.dataSourcesService.listDataSources(parsedLimit);
  }

  @Get(':id')
  async getDataSource(@Param('id') id: string): Promise<DataSourceDetailsDto> {
    return this.dataSourcesService.getDataSourceDetails(id);
  }
}
