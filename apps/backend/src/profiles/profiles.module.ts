import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DataSourcesModule } from '../data-sources/data-sources.module.js';
import { SchemasModule } from '../schemas/schemas.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProfilesRepository } from './profiles.repository.js';
import { ProfilesService } from './profiles.service.js';
import { ProfilesController } from './profiles.controller.js';

@Module({
  imports: [DatabaseModule, DataSourcesModule, SchemasModule, DevicesModule, AuthModule],
  controllers: [ProfilesController],
  providers: [ProfilesRepository, ProfilesService],
  exports: [ProfilesRepository, ProfilesService]
})
export class ProfilesModule {}
