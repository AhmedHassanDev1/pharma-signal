import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DataSourcesModule } from '../data-sources/data-sources.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SchemasRepository } from './schemas.repository.js';
import { SchemasService } from './schemas.service.js';
import { SchemasController } from './schemas.controller.js';

@Module({
  imports: [DatabaseModule, DataSourcesModule, DevicesModule, AuthModule],
  controllers: [SchemasController],
  providers: [SchemasRepository, SchemasService],
  exports: [SchemasRepository, SchemasService]
})
export class SchemasModule {}
