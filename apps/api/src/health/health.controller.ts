import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type HealthResponse, healthResponseSchema } from '@repo/contracts';
import type { PrismaClient } from '@repo/db';
import { Public } from '../auth/auth.guard.js';
import type { Env } from '../config/env.js';
import { ENV } from '../config/env.js';
import { APP_DB } from '../database/database.module.js';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(APP_DB) private readonly db: PrismaClient,
  ) {}

  /** Liveness: the process is up. */
  @Get()
  @ApiOkResponse({ description: 'The API process is up and serving requests.' })
  check(): HealthResponse {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      version: this.env.APP_VERSION,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  /** Readiness: dependencies (database) are reachable. */
  @Get('ready')
  async ready(): Promise<{ status: 'ok'; database: 'up' }> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable.');
    }
  }
}
