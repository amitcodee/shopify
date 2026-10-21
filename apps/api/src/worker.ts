/**
 * Standalone background worker (outbox delivery, unpaid-order expiry). Run it as its own
 * process in production with RUN_JOBS=false on the API instances; in development the API runs
 * these jobs in-process.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

/** Touched every 30 seconds; read by the worker's container health check. */
const WORKER_HEARTBEAT_FILE = join(tmpdir(), 'worker-heartbeat');

async function bootstrap(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv({ ...process.env, RUN_JOBS: 'true' });
  const app = await NestFactory.createApplicationContext(AppModule.register(env), {
    logger: new ConsoleLogger({ json: env.NODE_ENV === 'production' }),
  });
  app.enableShutdownHooks();
  Logger.log('Worker running', 'Worker');
  // Keep the process alive (jobs run on unref'd timers) and prove the event loop is not stuck:
  // the container health check fails once this file is older than two minutes.
  const heartbeat = () => writeFileSync(WORKER_HEARTBEAT_FILE, new Date().toISOString());
  heartbeat();
  setInterval(heartbeat, 30_000);
}

void bootstrap();
