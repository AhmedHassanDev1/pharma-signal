import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { DeviceAuthGuard } from '../auth/guards/device-auth.guard.js';
import { CurrentDevice } from '../auth/decorators/current-device.decorator.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import { uploadProfileSnapshotSchema } from '@pharma-signal/validation';
import {
  UploadProfileSnapshotRequestDto,
  UploadProfileSnapshotResponseDto
} from '@pharma-signal/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ProfilesService } from './profiles.service.js';

@Controller('agent')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post('profiles')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(DeviceAuthGuard)
  async uploadProfile(
    @CurrentDevice() device: DeviceWithRelations,
    @Body(new ZodValidationPipe(uploadProfileSnapshotSchema)) dto: UploadProfileSnapshotRequestDto
  ): Promise<UploadProfileSnapshotResponseDto> {
    return this.profilesService.uploadProfileSnapshot(device, dto);
  }

  @Post('profile-snapshots')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(DeviceAuthGuard)
  async uploadProfileAlias(
    @CurrentDevice() device: DeviceWithRelations,
    @Body(new ZodValidationPipe(uploadProfileSnapshotSchema)) dto: UploadProfileSnapshotRequestDto
  ): Promise<UploadProfileSnapshotResponseDto> {
    return this.profilesService.uploadProfileSnapshot(device, dto);
  }

  @Get('profiles/:id')
  @UseGuards(DeviceAuthGuard)
  async getProfileById(
    @CurrentDevice() device: DeviceWithRelations,
    @Param('id') id: string
  ) {
    return this.profilesService.getProfileById(device, id);
  }

  @Get('data-sources/:dataSourceId/profiles/latest')
  @UseGuards(DeviceAuthGuard)
  async getLatestProfile(
    @CurrentDevice() device: DeviceWithRelations,
    @Param('dataSourceId') dataSourceId: string
  ) {
    return this.profilesService.getLatestProfileByDataSource(device, dataSourceId);
  }
}
