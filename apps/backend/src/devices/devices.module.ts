import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { DevicesRepository } from './devices.repository.js';
import { DevicesService } from './devices.service.js';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  providers: [DevicesRepository, DevicesService],
  exports: [DevicesRepository, DevicesService]
})
export class DevicesModule {}
