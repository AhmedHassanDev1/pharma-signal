import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../database/prisma.service.js';
import { CURRENT_API_VERSION } from '@pharma-signal/config';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaMock: { isHealthy: ReturnType<typeof jest.fn<() => Promise<boolean>>> };

  beforeEach(async () => {
    prismaMock = {
      isHealthy: jest.fn<() => Promise<boolean>>().mockResolvedValue(true)
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock
        }
      ]
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return status ok with database up when healthy', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.version).toBe(CURRENT_API_VERSION);
    expect(result.service).toBe('pharma-signal-backend');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptime).toBe('number');
  });

  it('should return database down when db query fails', async () => {
    prismaMock.isHealthy.mockResolvedValueOnce(false);
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('down');
  });
});
