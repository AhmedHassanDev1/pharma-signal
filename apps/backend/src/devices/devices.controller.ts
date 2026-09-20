import { Controller, Get, Param, Query } from '@nestjs/common';
import { DevicesService } from './devices.service.js';
import { DeviceListItemDto } from '@pharma-signal/contracts';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  async listDevices(@Query('limit') limit?: string): Promise<DeviceListItemDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    return this.devicesService.listDevices(parsedLimit);
  }

  @Get(':id')
  async getDevice(@Param('id') id: string) {
    return this.devicesService.getDeviceById(id);
  }
}
