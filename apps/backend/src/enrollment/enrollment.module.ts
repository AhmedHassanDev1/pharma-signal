import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { EnrollmentTokenRepository } from './enrollment-token.repository.js';
import { EnrollmentTokenService } from './enrollment-token.service.js';
import { DeviceCredentialService } from './device-credential.service.js';
import { EnrollmentService } from './enrollment.service.js';
import { EnrollmentController } from './enrollment.controller.js';

@Module({
  imports: [ConfigModule, DatabaseModule, OrganizationsModule, DevicesModule],
  controllers: [EnrollmentController],
  providers: [
    EnrollmentTokenRepository,
    EnrollmentTokenService,
    DeviceCredentialService,
    EnrollmentService
  ],
  exports: [
    EnrollmentTokenService,
    EnrollmentTokenRepository,
    DeviceCredentialService,
    EnrollmentService
  ]
})
export class EnrollmentModule {}
