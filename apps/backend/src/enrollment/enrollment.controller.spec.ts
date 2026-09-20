import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { EnrollmentController } from './enrollment.controller.js';
import { EnrollmentService } from './enrollment.service.js';
import { EnrollDeviceRequestDto, EnrollDeviceResponseDto, DeviceStatus } from '@pharma-signal/contracts';

describe('EnrollmentController', () => {
  let controller: EnrollmentController;
  let enrollmentServiceMock: {
    enrollDevice: ReturnType<typeof jest.fn<(dto: EnrollDeviceRequestDto) => Promise<EnrollDeviceResponseDto>>>;
  };

  const mockResponse: EnrollDeviceResponseDto = {
    deviceId: 'device-uuid-1',
    organizationId: 'org-uuid-1',
    branchId: 'branch-uuid-1',
    deviceToken: 'test.device.token',
    status: DeviceStatus.ACTIVE,
    tenantId: 'org-uuid-1'
  };

  beforeEach(async () => {
    enrollmentServiceMock = {
      enrollDevice: jest.fn<(dto: EnrollDeviceRequestDto) => Promise<EnrollDeviceResponseDto>>().mockResolvedValue(mockResponse)
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentController],
      providers: [
        {
          provide: EnrollmentService,
          useValue: enrollmentServiceMock
        }
      ]
    }).compile();

    controller = module.get<EnrollmentController>(EnrollmentController);
  });

  it('should call enrollmentService.enrollDevice and return the response', async () => {
    const dto: EnrollDeviceRequestDto = {
      enrollmentToken: 'ps_et_test_token',
      agentInstanceId: 'agent-uuid-1',
      hostname: 'POS-ALPHA',
      os: 'Windows 11',
      appVersion: '0.1.0'
    };

    const result = await controller.enroll(dto);

    expect(enrollmentServiceMock.enrollDevice).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
