import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { EnrollmentModule } from './enrollment/enrollment.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DataSourcesModule } from './data-sources/data-sources.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    DatabaseModule,
    OrganizationsModule,
    DevicesModule,
    EnrollmentModule,
    AuthModule,
    DataSourcesModule,
    HealthModule
  ]
})
export class AppModule {}
