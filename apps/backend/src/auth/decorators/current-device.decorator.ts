import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeviceWithRelations } from '../../devices/devices.repository.js';

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceWithRelations => {
    const request = ctx.switchToHttp().getRequest();
    return request.device;
  }
);
