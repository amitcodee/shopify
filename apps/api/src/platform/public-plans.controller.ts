import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { PublicContact } from '@repo/contracts';
import { Public } from '../auth/auth.guard.js';
import { PlansService } from './plans.service.js';
import { PlatformSettingsService } from './platform-settings.service.js';

const RESERVED_EMAIL_DOMAIN = /@(?:[^@]+\.)?example\.(?:com|net|org)$/i;

/** The plan fields safe to show anyone (e.g. on the platform's marketing page). */
export interface PublicPlan {
  code: string;
  name: string;
  priceMonthly: number;
  currency: string;
  trialDays: number;
  introPrice: number | null;
  introCycles: number;
  /** The intro price runs on a Razorpay offer, which only applies to UPI AutoPay. */
  introUpiOnly: boolean;
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
      currency: p.currency,
      trialDays: p.trialDays,
      introPrice: p.introPrice,
      introCycles: p.introCycles,
      introUpiOnly: p.razorpayOfferId !== null,
      maxProducts: p.maxProducts,
      maxStaff: p.maxStaff,
      maxOrdersPerMonth: p.maxOrdersPerMonth,
      transactionFeeBps: p.transactionFeeBps,
    }));
  }

  /**
   * How to reach the operator, for the marketing site's contact and legal pages. Every field is
   * null until an operator sets it; the default support email sits on a reserved example domain
   * (RFC 2606) nobody reads, so it is hidden too.
   */
  @Get('contact')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({
    description:
      'Support email, legal entity name, registered address, GSTIN, phone and Grievance Officer; null when not set.',
  })
  async contact(): Promise<PublicContact> {
    const s = await this.platformSettings.get();
    const orNull = (value: string) => (value.trim() === '' ? null : value);
    const email = (value: string) =>
      value === '' || RESERVED_EMAIL_DOMAIN.test(value) ? null : value;
    return {
      supportEmail: email(s.supportEmail),
      legalName: orNull(s.legalName),
      registeredAddress: orNull(s.registeredAddress),
      gstin: orNull(s.gstin),
      supportPhone: orNull(s.supportPhone),
      grievanceOfficerName: orNull(s.grievanceOfficerName),
      grievanceOfficerEmail: email(s.grievanceOfficerEmail),
    };
  }
}
