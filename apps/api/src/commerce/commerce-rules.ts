import { Injectable } from '@nestjs/common';
import type { ShippingOption } from '@repo/contracts';
import type { TenantTx } from '@repo/db';
import type { PricingDiscount } from '../checkout/pricing.js';

export interface Destination {
  country?: string;
  region?: string;
}

export interface CartSummary {
  subtotal: number;
  weightGrams: number;
  requiresShipping: boolean;
}

export interface DiscountEvaluation {
  code: string;
  applied: boolean;
  message?: string;
  rule: PricingDiscount | null;
  discountId: string | null;
}

const FREE_FALLBACK: ShippingOption = { id: 'free-standard', name: 'Standard shipping', price: 0 };

function within(value: number, min: number | null, max: number | null): boolean {
  return (min === null || value >= min) && (max === null || value <= max);
}

/**
 * Shipping options for a destination. A zone listing the country beats a "*" (rest of world)
 * zone. Stores that have not configured shipping get free standard shipping everywhere.
 */
@Injectable()
export class ShippingRules {
  async optionsFor(
    tx: TenantTx,
    storeId: string,
    destination: Destination,
    cart: CartSummary,
  ): Promise<ShippingOption[]> {
    if (!cart.requiresShipping) return [];
    const zones = await tx.shippingZone.findMany({
      where: { storeId },
      include: { rates: { orderBy: { price: 'asc' } } },
    });
    if (zones.length === 0) return [FREE_FALLBACK];
    if (!destination.country) return [];

    const country = destination.country.toUpperCase();
    const specific = zones.filter((z) => z.countries.includes(country));
    const matching =
      specific.length > 0 ? specific : zones.filter((z) => z.countries.includes('*'));
    return matching
      .flatMap((z) => z.rates)
      .filter(
        (r) =>
          within(cart.subtotal, r.minSubtotal, r.maxSubtotal) &&
          within(cart.weightGrams, r.minWeightGrams, r.maxWeightGrams),
      )
      .sort((a, b) => a.price - b.price)
      .map((r) => ({ id: r.id, name: r.name, price: r.price }));
  }
}

/** Tax rate for a destination: a region-specific rate overrides the country-wide one. */
@Injectable()
export class TaxRules {
  async rateFor(
    tx: TenantTx,
    storeId: string,
    destination: Destination,
  ): Promise<{ rateBps: number; taxShipping: boolean; name: string | null }> {
    if (!destination.country) return { rateBps: 0, taxShipping: false, name: null };
    const region = destination.region?.trim().toUpperCase() ?? '';
    const rates = await tx.taxRate.findMany({
      where: { storeId, country: destination.country.toUpperCase(), region: { in: [region, ''] } },
    });
    const rate =
      rates.find((r) => r.region === region && region !== '') ?? rates.find((r) => r.region === '');
    return rate
      ? { rateBps: rate.rateBps, taxShipping: rate.appliesToShipping, name: rate.name }
      : { rateBps: 0, taxShipping: false, name: null };
  }
}

@Injectable()
export class DiscountRules {
  async evaluate(
    tx: TenantTx,
    storeId: string,
    rawCode: string,
    subtotal: number,
  ): Promise<DiscountEvaluation> {
    const code = rawCode.trim().toUpperCase();
    const invalid = (message: string): DiscountEvaluation => ({
      code,
      applied: false,
      message,
      rule: null,
      discountId: null,
    });
    const discount = await tx.discountCode.findUnique({
      where: { storeId_code: { storeId, code } },
    });
    const now = new Date();
    if (!discount || !discount.active) return invalid('This discount code is not valid.');
    if (discount.startsAt && discount.startsAt > now)
      return invalid('This discount code is not active yet.');
    if (discount.endsAt && discount.endsAt <= now)
      return invalid('This discount code has expired.');
    if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
      return invalid('This discount code has reached its usage limit.');
    }
    if (discount.minSubtotal !== null && subtotal < discount.minSubtotal) {
      return invalid('Your order does not meet the minimum for this discount.');
    }
    return {
      code,
      applied: true,
      rule: { type: discount.type, value: discount.value },
      discountId: discount.id,
    };
  }

  /**
   * Counts a redemption once the order is paid, so unpaid checkouts cannot burn limited codes.
   * The payment has already succeeded, so the count is capped at the limit instead of failing.
   */
  async redeem(tx: TenantTx, storeId: string, code: string): Promise<void> {
    await tx.$executeRaw`
      UPDATE "DiscountCode"
      SET "usedCount" = CASE WHEN "usageLimit" IS NULL OR "usedCount" < "usageLimit"
                             THEN "usedCount" + 1 ELSE "usedCount" END,
          "updatedAt" = now()
      WHERE "storeId" = ${storeId}::uuid AND code = ${code}`;
  }
}
