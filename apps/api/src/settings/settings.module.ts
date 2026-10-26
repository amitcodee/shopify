import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { StorefrontModule } from '../storefront/storefront.module.js';
import { CommerceSettingsController, CommerceSettingsService } from './commerce-settings.js';
import { AnthropicThemeAiClient, THEME_AI_CLIENT } from './theme-ai.js';
import { ThemeEditorController, ThemeEditorService } from './theme-editor.js';
import {
  DNS_VERIFIER,
  DomainsController,
  DomainsService,
  MockDnsVerifier,
  SystemDnsVerifier,
} from './domains.js';

@Module({
  imports: [StorefrontModule, PaymentsModule],
  controllers: [DomainsController, CommerceSettingsController, ThemeEditorController],
  providers: [
    DomainsService,
    CommerceSettingsService,
    ThemeEditorService,
    {
      provide: THEME_AI_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.ANTHROPIC_API_KEY
          ? new AnthropicThemeAiClient(env.ANTHROPIC_API_KEY, env.THEME_AI_MODEL)
          : null,
    },
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
