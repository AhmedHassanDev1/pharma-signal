import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DataSourcesModule } from '../data-sources/data-sources.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SyncBatchesRepository } from './sync-batches.repository.js';
import { CanonicalRecordsRepository } from './canonical-records.repository.js';
import { SyncService } from './sync.service.js';
import { SyncController } from './sync.controller.js';

@Module({
  imports: [DatabaseModule, DataSourcesModule, DevicesModule, AuthModule],
  controllers: [SyncController],
  providers: [SyncBatchesRepository, CanonicalRecordsRepository, SyncService],
  exports: [SyncBatchesRepository, CanonicalRecordsRepository, SyncService]
})
export class SyncModule {}
