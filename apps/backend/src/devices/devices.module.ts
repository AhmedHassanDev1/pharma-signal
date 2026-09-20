import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesService } from './devices.service.js';
import { DevicesController } from './devices.controller.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [DevicesController],
  providers: [DevicesRepository, DevicesService],
  exports: [DevicesRepository, DevicesService]
})
export class DevicesModule {}
