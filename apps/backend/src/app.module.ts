import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { DatabaseModule } from './database/database.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { EnrollmentModule } from './enrollment/enrollment.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DataSourcesModule } from './data-sources/data-sources.module.js';
import { SchemasModule } from './schemas/schemas.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { SyncModule } from './sync/sync.module.js';
import { PlatformModule } from './platform/platform.module.js';

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
    SchemasModule,
    ProfilesModule,
    SyncModule,
    HealthModule,
    PlatformModule
  ]
})
export class AppModule {}
