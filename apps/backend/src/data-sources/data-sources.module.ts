import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { DataSourcesRepository } from './data-sources.repository.js';
import { DataSourcesService } from './data-sources.service.js';
import { DataSourcesController } from './data-sources.controller.js';
import { DataSourcesManagementController } from './data-sources-management.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule, DevicesModule],
  controllers: [DataSourcesController, DataSourcesManagementController],
  providers: [DataSourcesRepository, DataSourcesService],
  exports: [DataSourcesRepository, DataSourcesService]
})
export class DataSourcesModule {}
