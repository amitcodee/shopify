/**
 * Standalone background worker (outbox delivery, unpaid-order expiry). Run it as its own
 * process in production with RUN_JOBS=false on the API instances; in development the API runs
 * these jobs in-process.
 */
import { existsSync } from 'node:fs';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv({ ...process.env, RUN_JOBS: 'true' });
  const app = await NestFactory.createApplicationContext(AppModule.register(env), {
    logger: new ConsoleLogger({ json: env.NODE_ENV === 'production' }),
  });
  app.enableShutdownHooks();
  Logger.log('Worker running', 'Worker');
  // Keep the process alive; jobs run on unref'd timers.
  setInterval(() => undefined, 1 << 30);
}

void bootstrap();
