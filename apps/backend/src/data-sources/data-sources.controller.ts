import {
  Controller,
  Post,
  Body,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { DeviceAuthGuard } from '../auth/guards/device-auth.guard.js';
import { CurrentDevice } from '../auth/decorators/current-device.decorator.js';
import { DeviceWithRelations } from '../devices/devices.repository.js';
import { registerDataSourceSchema } from '@pharma-signal/validation';
import {
  RegisterDataSourceRequestDto,
  RegisterDataSourceResponseDto
} from '@pharma-signal/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { DataSourcesService } from './data-sources.service.js';

@Controller('agent')
export class DataSourcesController {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  @Post('data-sources')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(DeviceAuthGuard)
  async registerDataSource(
    @CurrentDevice() device: DeviceWithRelations,
    @Body(new ZodValidationPipe(registerDataSourceSchema)) dto: RegisterDataSourceRequestDto
  ): Promise<RegisterDataSourceResponseDto> {
    return this.dataSourcesService.registerDataSource(device, dto);
  }
}
