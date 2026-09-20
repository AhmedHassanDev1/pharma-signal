import { Controller, Post, Body, UsePipes, HttpCode, HttpStatus } from '@nestjs/common';
import { enrollDeviceSchema } from '@pharma-signal/validation';
import { EnrollDeviceRequestDto, EnrollDeviceResponseDto } from '@pharma-signal/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { EnrollmentService } from './enrollment.service.js';

@Controller('agent')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post('enroll')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(enrollDeviceSchema))
  async enroll(@Body() dto: EnrollDeviceRequestDto): Promise<EnrollDeviceResponseDto> {
    return this.enrollmentService.enrollDevice(dto);
  }
}
