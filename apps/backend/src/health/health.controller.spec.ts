import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { CURRENT_API_VERSION } from '@pharma-signal/config';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController]
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return status ok with version and timestamp', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.version).toBe(CURRENT_API_VERSION);
    expect(result.service).toBe('pharma-signal-backend');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptime).toBe('number');
  });
});
