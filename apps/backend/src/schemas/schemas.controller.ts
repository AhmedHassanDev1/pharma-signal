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
import { uploadSchemaSnapshotSchema } from '@pharma-signal/validation';
import {
  UploadSchemaSnapshotRequestDto,
  UploadSchemaSnapshotResponseDto
} from '@pharma-signal/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SchemasService } from './schemas.service.js';

@Controller('agent')
export class SchemasController {
  constructor(private readonly schemasService: SchemasService) {}

  @Post('schemas')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(DeviceAuthGuard)
  async uploadSchema(
    @CurrentDevice() device: DeviceWithRelations,
    @Body(new ZodValidationPipe(uploadSchemaSnapshotSchema)) dto: UploadSchemaSnapshotRequestDto
  ): Promise<UploadSchemaSnapshotResponseDto> {
    return this.schemasService.uploadSchemaSnapshot(device, dto);
  }

  @Post('schema-snapshots')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(DeviceAuthGuard)
  async uploadSchemaSnapshotAlias(
    @CurrentDevice() device: DeviceWithRelations,
    @Body(new ZodValidationPipe(uploadSchemaSnapshotSchema)) dto: UploadSchemaSnapshotRequestDto
  ): Promise<UploadSchemaSnapshotResponseDto> {
    return this.schemasService.uploadSchemaSnapshot(device, dto);
  }

  @Get('schemas/:id')
  @UseGuards(DeviceAuthGuard)
  async getSnapshotById(
    @CurrentDevice() device: DeviceWithRelations,
    @Param('id') id: string
  ) {
    return this.schemasService.getSnapshotById(device, id);
  }

  @Get('data-sources/:dataSourceId/schemas/latest')
  @UseGuards(DeviceAuthGuard)
  async getLatestSnapshot(
    @CurrentDevice() device: DeviceWithRelations,
    @Param('dataSourceId') dataSourceId: string
  ) {
    return this.schemasService.getLatestSnapshotByDataSource(device, dataSourceId);
  }
}
