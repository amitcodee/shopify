import { type INestApplication, VersioningType } from '@nestjs/common';
import type { Express } from 'express';
import helmet from 'helmet';
import { setupApiDocs } from './api-docs.js';
import { requestId } from './common/request-id.middleware.js';
import type { Env } from './config/env.js';

/** HTTP-level setup shared by the real server and integration tests. */
export function configureApp(app: INestApplication, env: Env): void {
  const express = app.getHttpAdapter().getInstance() as Express;
  express.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(helmet());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  setupApiDocs(app, env);
}
