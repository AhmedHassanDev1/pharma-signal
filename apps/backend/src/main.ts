import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { API_V1_PREFIX, DEFAULT_PORTS } from '@pharma-signal/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use standardized API prefix: /api/v1
  const globalPrefix = API_V1_PREFIX.replace(/^\//, '');
  app.setGlobalPrefix(globalPrefix);

  app.enableCors();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORTS.BACKEND;
  await app.listen(port);

  console.log(`[Pharma Signal Backend] Running on http://localhost:${port}/${globalPrefix}`);
  console.log(`[Pharma Signal Backend] Health check: http://localhost:${port}/${globalPrefix}/health`);
}

bootstrap().catch((err) => {
  console.error('[Pharma Signal Backend] Bootstrap error:', err);
  process.exit(1);
});
