import { Module } from '@nestjs/common';
import { EnrollmentModule } from '../enrollment/enrollment.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { DeviceAuthGuard } from './guards/device-auth.guard.js';

@Module({
  imports: [EnrollmentModule, DevicesModule],
  providers: [DeviceAuthGuard],
  exports: [DeviceAuthGuard, EnrollmentModule, DevicesModule]
})
export class AuthModule {}
