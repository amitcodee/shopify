import { Controller, Get, HttpCode, NotFoundException, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/auth.guard.js';
import { StoreResolver } from './store-resolver.js';

/**
 * "Ask" endpoint for on-demand TLS (e.g. Caddy `on_demand_tls`): certificates are only issued
 * for hostnames that belong to a live store, so attackers cannot make us request arbitrary certs.
 */
@ApiTags('storefront')
@Public()
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('domains')
export class TlsCheckController {
  constructor(private readonly resolver: StoreResolver) {}

  @Get('tls-check')
  @HttpCode(200)
  async check(@Query('domain') domain?: string): Promise<{ ok: true }> {
    if (!domain || domain.length > 253 || !(await this.resolver.resolve(domain))) {
      throw new NotFoundException();
    }
    return { ok: true };
  }
}
