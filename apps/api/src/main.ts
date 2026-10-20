import { existsSync } from 'node:fs';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv();

  // rawBody is needed to verify payment-provider webhook signatures.
  const app = await NestFactory.create(AppModule.register(env), {
    rawBody: true,
    // Structured JSON logs in production (one object per line, ready for log shipping).
    logger: new ConsoleLogger({ json: env.NODE_ENV === 'production' }),
  });
  configureApp(app, env);
  await app.listen(env.API_PORT);

  const url = `http://localhost:${env.API_PORT}`;
  Logger.log(`API listening on ${url}/api/v1 (docs: ${url}/api/docs)`, 'Bootstrap');
}

void bootstrap();
