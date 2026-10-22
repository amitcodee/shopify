import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.guard.js';
import { PlansService } from './plans.service.js';
import { PlatformSettingsService } from './platform-settings.service.js';

/** The plan fields safe to show anyone (e.g. on the platform's marketing page). */
export interface PublicPlan {
  code: string;
  name: string;
  priceMonthly: number;
  maxProducts: number | null;
  maxStaff: number | null;
  maxOrdersPerMonth: number | null;
  transactionFeeBps: number;
}

@ApiTags('public')
@Public()
@Controller('public')
export class PublicPlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /** Active plans in display order. No auth; ids, defaults and inactive plans stay private. */
  @Get('plans')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ description: 'Active pricing plans, ordered for display.' })
  async list(): Promise<PublicPlan[]> {
    return (await this.plans.list(true)).map((p) => ({
      code: p.code,
      name: p.name,
      priceMonthly: p.priceMonthly,
      maxProducts: p.maxProducts,
      maxStaff: p.maxStaff,
      maxOrdersPerMonth: p.maxOrdersPerMonth,
      transactionFeeBps: p.transactionFeeBps,
    }));
  }

  /** How to reach platform support (for the marketing site's contact page). */
  @Get('contact')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ description: 'The platform support email address.' })
  async contact(): Promise<{ supportEmail: string }> {
    const { supportEmail } = await this.platformSettings.get();
    return { supportEmail };
  }
}
