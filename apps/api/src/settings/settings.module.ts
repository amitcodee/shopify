import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { StorefrontModule } from '../storefront/storefront.module.js';
import { CommerceSettingsController, CommerceSettingsService } from './commerce-settings.js';
import {
  DNS_VERIFIER,
  DomainsController,
  DomainsService,
  MockDnsVerifier,
  SystemDnsVerifier,
} from './domains.js';

@Module({
  imports: [StorefrontModule],
  controllers: [DomainsController, CommerceSettingsController],
  providers: [
    DomainsService,
    CommerceSettingsService,
    {
      provide: DNS_VERIFIER,
      inject: [ENV],
      useFactory: (env: Env) =>
        (env.DNS_VERIFIER ?? (env.NODE_ENV === 'production' ? 'dns' : 'mock')) === 'dns'
          ? new SystemDnsVerifier()
          : new MockDnsVerifier(),
    },
  ],
})
export class SettingsModule {}
