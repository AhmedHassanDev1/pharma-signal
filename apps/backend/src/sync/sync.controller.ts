import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { DeviceAuthGuard } from '../auth/guards/device-auth.guard.js';
import { CurrentDevice } from '../auth/decorators/current-device.decorator.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import { canonicalSyncSchema } from '@pharma-signal/validation';
import {
  CanonicalSyncRequestDto,
  CanonicalSyncResponseDto
} from '@pharma-signal/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SyncService } from './sync.service.js';

@Controller('agent')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceAuthGuard)
  async sync(
    @CurrentDevice() device: DeviceWithRelations,
    @Headers('x-sync-batch-id') headerSyncBatchId: string | undefined,
    @Body(new ZodValidationPipe(canonicalSyncSchema)) dto: CanonicalSyncRequestDto
  ): Promise<CanonicalSyncResponseDto> {
    return this.syncService.processSync(device, dto, headerSyncBatchId);
  }

  @Get('sync/batches/:syncBatchId')
  @UseGuards(DeviceAuthGuard)
  async getBatch(
    @CurrentDevice() device: DeviceWithRelations,
    @Param('syncBatchId') syncBatchId: string,
    @Query('dataSourceId') dataSourceId: string
  ) {
    return this.syncService.getBatchBySyncBatchId(device, dataSourceId, syncBatchId);
  }

  @Get('data-sources/:dataSourceId/sync/diagnostics')
  @UseGuards(DeviceAuthGuard)
  async getDiagnostics(
    @CurrentDevice() device: DeviceWithRelations,
    @Param('dataSourceId') dataSourceId: string
  ) {
    return this.syncService.getDataSourceDiagnostics(device, dataSourceId);
  }

  @Get('data-sources/:dataSourceId/sync/batches')
  @UseGuards(DeviceAuthGuard)
  async getBatches(
    @CurrentDevice() device: DeviceWithRelations,
    @Param('dataSourceId') dataSourceId: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.syncService.getDataSourceBatches(device, dataSourceId, parsedLimit);
  }
}
