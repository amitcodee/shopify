import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type Discount,
  discountInputSchema,
  parseTheme,
  type PresentmentCurrency,
  presentmentCurrenciesInputSchema,
  presentmentCurrencySchema,
  type ShippingZone,
  type StorefrontAccess,
  storefrontAccessInputSchema,
  shippingRateInputSchema,
  shippingZoneInputSchema,
  type TaxRate,
  taxRateInputSchema,
  type Theme,
  themeInputSchema,
} from '@repo/contracts';
import { Prisma, type DiscountCode, type TenantTx } from '@repo/db';
import { ConflictException } from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { decryptSecret, encryptSecret } from '../common/crypto.js';
import { ENV, type Env } from '../config/env.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { TenantDb } from '../database/database.module.js';
import { PaymentAccountsService } from '../payments/payment-accounts.service.js';
import { StoreResolver } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

type ZoneInput = z.output<typeof shippingZoneInputSchema>;
type RateInput = z.output<typeof shippingRateInputSchema>;
type TaxInput = z.output<typeof taxRateInputSchema>;
type DiscountBody = z.output<typeof discountInputSchema>;

const discountToggleSchema = z.strictObject({ active: z.boolean() });

function toDiscount(d: DiscountCode): Discount {
  return {
    id: d.id,
    code: d.code,
    type: d.type,
    value: d.value,
    minSubtotal: d.minSubtotal,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    startsAt: d.startsAt?.toISOString() ?? null,
    endsAt: d.endsAt?.toISOString() ?? null,
    active: d.active,
    createdAt: d.createdAt.toISOString(),
  };
}

/** Theme, shipping, taxes and discounts: per-store commerce configuration. */
@Injectable()
export class CommerceSettingsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
    private readonly resolver: StoreResolver,
    @Inject(ENV) private readonly env: Env,
    private readonly payments: PaymentAccountsService,
  ) {}

  private record(
    tx: TenantTx,
    storeId: string,
    actor: AuthUser,
    action: string,
    entityId: string,
    meta: RequestMeta,
    data?: Prisma.InputJsonValue,
  ) {
    return this.audit.record(tx, {
      storeId,
      actorUserId: actor.id,
      action,
      entityType: action.split('.')[0] ?? 'settings',
      entityId,
      data,
      meta,
    });
  }

  // Theme
  async getTheme(storeId: string): Promise<Theme> {
    const store = await this.tenantDb.run(storeId, (tx) =>
      tx.store.findUniqueOrThrow({ where: { id: storeId } }),
    );
    return parseTheme(store.themePreset, store.themeSettings);
  }

  async saveTheme(
    storeId: string,
    input: Theme,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Theme> {
    await this.tenantDb.run(storeId, async (tx) => {
      await tx.store.update({
        where: { id: storeId },
        data: { themePreset: input.preset, themeSettings: input.settings },
      });
      await this.record(tx, storeId, actor, 'theme.updated', storeId, meta, {
        preset: input.preset,
      });
    });
    this.resolver.invalidate();
    return input;
  }

  // Storefront password page
  async getStorefrontAccess(storeId: string): Promise<StorefrontAccess> {
    const store = await this.tenantDb.run(storeId, (tx) =>
      tx.store.findUniqueOrThrow({ where: { id: storeId } }),
    );
    return {
      enabled: store.passwordProtected,
      password: store.storefrontPasswordEncrypted
        ? decryptSecret(this.env.APP_ENCRYPTION_KEY, store.storefrontPasswordEncrypted)
        : null,
      message: store.passwordMessage,
    };
  }

  async saveStorefrontAccess(
    storeId: string,
    input: z.output<typeof storefrontAccessInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<StorefrontAccess> {
    await this.tenantDb.run(storeId, async (tx) => {
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      if (input.enabled && !input.password && !store.storefrontPasswordEncrypted) {
        throw new BadRequestException('Set a password to protect the store.');
      }
      await tx.store.update({
        where: { id: storeId },
        data: {
          passwordProtected: input.enabled,
          passwordMessage: input.message,
          // A new password (or switching protection on) signs every visitor out.
          ...(input.password
            ? {
                storefrontPasswordEncrypted: encryptSecret(
                  this.env.APP_ENCRYPTION_KEY,
                  input.password,
                ),
                storefrontPasswordChangedAt: new Date(),
              }
            : input.enabled && !store.passwordProtected
              ? { storefrontPasswordChangedAt: new Date() }
              : {}),
        },
      });
      await this.record(tx, storeId, actor, 'storefront_password.updated', storeId, meta, {
        enabled: input.enabled,
        passwordChanged: Boolean(input.password),
      });
    });
    this.resolver.invalidate();
    return this.getStorefrontAccess(storeId);
  }

  // Presentment currencies
  async getCurrencies(storeId: string): Promise<PresentmentCurrency[]> {
    const store = await this.tenantDb.run(storeId, (tx) =>
      tx.store.findUniqueOrThrow({ where: { id: storeId } }),
    );
    return z.array(presentmentCurrencySchema).catch([]).parse(store.presentmentCurrencies);
  }

  async saveCurrencies(
    storeId: string,
    currencies: PresentmentCurrency[],
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PresentmentCurrency[]> {
    await this.tenantDb.run(storeId, async (tx) => {
      const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
      if (currencies.some((c) => c.currency === store.currency)) {
        throw new BadRequestException(`${store.currency} is the store currency already.`);
      }
      const account = await tx.paymentAccount.findUnique({ where: { storeId } });
      const unsupported = account
        ? currencies.filter((c) => !this.payments.supportsCurrency(account.provider, c.currency))
        : [];
      if (unsupported.length > 0) {
        throw new BadRequestException(
          `Your payment gateway cannot charge in ${unsupported.map((c) => c.currency).join(', ')}.`,
        );
      }
      await tx.store.update({
        where: { id: storeId },
        data: { presentmentCurrencies: currencies },
      });
      await this.record(tx, storeId, actor, 'currencies.updated', storeId, meta, {
        currencies: currencies.map((c) => `${c.currency}@${c.rate}`),
      });
    });
    this.resolver.invalidate();
    return currencies;
  }

  // Shipping
  listZones(storeId: string): Promise<ShippingZone[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      const zones = await tx.shippingZone.findMany({
        where: { storeId },
        include: { rates: { orderBy: { price: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
      return zones.map((z) => ({
        id: z.id,
        name: z.name,
        countries: z.countries,
        rates: z.rates.map((r) => ({
          id: r.id,
          name: r.name,
          price: r.price,
          minSubtotal: r.minSubtotal,
          maxSubtotal: r.maxSubtotal,
          minWeightGrams: r.minWeightGrams,
          maxWeightGrams: r.maxWeightGrams,
        })),
      }));
    });
  }

  async createZone(storeId: string, input: ZoneInput, actor: AuthUser, meta: RequestMeta) {
    await this.tenantDb.run(storeId, async (tx) => {
      const zone = await tx.shippingZone.create({
        data: { storeId, name: input.name, countries: input.countries },
      });
      await this.record(tx, storeId, actor, 'shipping.zone_created', zone.id, meta, {
        name: input.name,
      });
    });
    return this.listZones(storeId);
  }

  async updateZone(
    storeId: string,
    zoneId: string,
    input: ZoneInput,
    actor: AuthUser,
    meta: RequestMeta,
  ) {
    await this.tenantDb.run(storeId, async (tx) => {
      const result = await tx.shippingZone.updateMany({
        where: { id: zoneId, storeId },
        data: input,
      });
      if (result.count === 0) throw new NotFoundException('Shipping zone not found.');
      await this.record(tx, storeId, actor, 'shipping.zone_updated', zoneId, meta);
    });
    return this.listZones(storeId);
  }

  async deleteZone(storeId: string, zoneId: string, actor: AuthUser, meta: RequestMeta) {
    await this.tenantDb.run(storeId, async (tx) => {
      const result = await tx.shippingZone.deleteMany({ where: { id: zoneId, storeId } });
      if (result.count === 0) throw new NotFoundException('Shipping zone not found.');
      await this.record(tx, storeId, actor, 'shipping.zone_deleted', zoneId, meta);
    });
    return this.listZones(storeId);
  }

  async addRate(
    storeId: string,
    zoneId: string,
    input: RateInput,
    actor: AuthUser,
    meta: RequestMeta,
  ) {
    await this.tenantDb.run(storeId, async (tx) => {
      const zone = await tx.shippingZone.findFirst({ where: { id: zoneId, storeId } });
      if (!zone) throw new NotFoundException('Shipping zone not found.');
      const rate = await tx.shippingRate.create({
        data: {
          storeId,
          zoneId,
          name: input.name,
          price: input.price,
          minSubtotal: input.minSubtotal ?? null,
          maxSubtotal: input.maxSubtotal ?? null,
          minWeightGrams: input.minWeightGrams ?? null,
          maxWeightGrams: input.maxWeightGrams ?? null,
        },
      });
      await this.record(tx, storeId, actor, 'shipping.rate_created', rate.id, meta, {
        name: input.name,
        price: input.price,
      });
    });
    return this.listZones(storeId);
  }

  async deleteRate(storeId: string, rateId: string, actor: AuthUser, meta: RequestMeta) {
    await this.tenantDb.run(storeId, async (tx) => {
      const result = await tx.shippingRate.deleteMany({ where: { id: rateId, storeId } });
      if (result.count === 0) throw new NotFoundException('Shipping rate not found.');
      await this.record(tx, storeId, actor, 'shipping.rate_deleted', rateId, meta);
    });
    return this.listZones(storeId);
  }

  // Taxes
  listTaxRates(storeId: string): Promise<TaxRate[]> {
    return this.tenantDb.run(storeId, (tx) =>
      tx.taxRate
        .findMany({ where: { storeId }, orderBy: [{ country: 'asc' }, { region: 'asc' }] })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            country: r.country,
            region: r.region,
            name: r.name,
            rateBps: r.rateBps,
            appliesToShipping: r.appliesToShipping,
          })),
        ),
    );
  }

  async upsertTaxRate(storeId: string, input: TaxInput, actor: AuthUser, meta: RequestMeta) {
    await this.tenantDb.run(storeId, async (tx) => {
      const rate = await tx.taxRate.upsert({
        where: {
          storeId_country_region: { storeId, country: input.country, region: input.region },
        },
        update: {
          name: input.name,
          rateBps: input.rateBps,
          appliesToShipping: input.appliesToShipping,
        },
        create: { storeId, ...input },
      });
      await this.record(tx, storeId, actor, 'tax.rate_saved', rate.id, meta, {
        country: input.country,
        region: input.region,
        rateBps: input.rateBps,
      });
    });
    return this.listTaxRates(storeId);
  }

  async deleteTaxRate(storeId: string, rateId: string, actor: AuthUser, meta: RequestMeta) {
    await this.tenantDb.run(storeId, async (tx) => {
      const result = await tx.taxRate.deleteMany({ where: { id: rateId, storeId } });
      if (result.count === 0) throw new NotFoundException('Tax rate not found.');
      await this.record(tx, storeId, actor, 'tax.rate_deleted', rateId, meta);
    });
    return this.listTaxRates(storeId);
  }

  // Discounts
  listDiscounts(storeId: string): Promise<Discount[]> {
    return this.tenantDb.run(storeId, async (tx) =>
      (await tx.discountCode.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } })).map(
        toDiscount,
      ),
    );
  }

  async createDiscount(
    storeId: string,
    input: DiscountBody,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Discount> {
    try {
      return await this.tenantDb.run(storeId, async (tx) => {
        const discount = await tx.discountCode.create({
          data: {
            storeId,
            code: input.code,
            type: input.type,
            value: input.type === 'FREE_SHIPPING' ? 0 : input.value,
            minSubtotal: input.minSubtotal ?? null,
            usageLimit: input.usageLimit ?? null,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            active: input.active,
          },
        });
        await this.record(tx, storeId, actor, 'discount.created', discount.id, meta, {
          code: input.code,
        });
        return toDiscount(discount);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A discount with this code already exists.');
      }
      throw error;
    }
  }

  setDiscountActive(
    storeId: string,
    discountId: string,
    active: boolean,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<Discount> {
    return this.tenantDb.run(storeId, async (tx) => {
      const existing = await tx.discountCode.findFirst({ where: { id: discountId, storeId } });
      if (!existing) throw new NotFoundException('Discount not found.');
      const updated = await tx.discountCode.update({ where: { id: discountId }, data: { active } });
      await this.record(
        tx,
        storeId,
        actor,
        active ? 'discount.activated' : 'discount.deactivated',
        discountId,
        meta,
      );
      return toDiscount(updated);
    });
  }

  async deleteDiscount(
    storeId: string,
    discountId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    await this.tenantDb.run(storeId, async (tx) => {
      const result = await tx.discountCode.deleteMany({ where: { id: discountId, storeId } });
      if (result.count === 0) throw new NotFoundException('Discount not found.');
      await this.record(tx, storeId, actor, 'discount.deleted', discountId, meta);
    });
  }
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId')
export class CommerceSettingsController {
  constructor(private readonly settings: CommerceSettingsService) {}

  @Get('theme')
  @RequirePermission('settings:read')
  theme(@CurrentStore() store: StoreContext): Promise<Theme> {
    return this.settings.getTheme(store.id);
  }

  @Put('theme')
  @RequirePermission('themes:write')
  @ApiZodBody(themeInputSchema)
  saveTheme(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(themeInputSchema)) body: Theme,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Theme> {
    return this.settings.saveTheme(store.id, body, user, meta);
  }

  @Get('storefront-access')
  @RequirePermission('settings:read')
  storefrontAccess(@CurrentStore() store: StoreContext): Promise<StorefrontAccess> {
    return this.settings.getStorefrontAccess(store.id);
  }

  @Put('storefront-access')
  @RequirePermission('themes:write')
  @ApiZodBody(storefrontAccessInputSchema)
  saveStorefrontAccess(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(storefrontAccessInputSchema))
    body: z.output<typeof storefrontAccessInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<StorefrontAccess> {
    return this.settings.saveStorefrontAccess(store.id, body, user, meta);
  }

  @Get('currencies')
  @RequirePermission('settings:read')
  currencies(@CurrentStore() store: StoreContext): Promise<PresentmentCurrency[]> {
    return this.settings.getCurrencies(store.id);
  }

  @Put('currencies')
  @RequirePermission('settings:write')
  @ApiZodBody(presentmentCurrenciesInputSchema)
  saveCurrencies(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(presentmentCurrenciesInputSchema))
    body: z.output<typeof presentmentCurrenciesInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PresentmentCurrency[]> {
    return this.settings.saveCurrencies(store.id, body.currencies, user, meta);
  }

  @Get('shipping-zones')
  @RequirePermission('settings:read')
  zones(@CurrentStore() store: StoreContext): Promise<ShippingZone[]> {
    return this.settings.listZones(store.id);
  }

  @Post('shipping-zones')
  @RequirePermission('settings:write')
  @ApiZodBody(shippingZoneInputSchema)
  createZone(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(shippingZoneInputSchema)) body: ZoneInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.createZone(store.id, body, user, meta);
  }

  @Put('shipping-zones/:zoneId')
  @RequirePermission('settings:write')
  @ApiZodBody(shippingZoneInputSchema)
  updateZone(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('zoneId', UuidParam) zoneId: string,
    @Body(new ZodPipe(shippingZoneInputSchema)) body: ZoneInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.updateZone(store.id, zoneId, body, user, meta);
  }

  @Delete('shipping-zones/:zoneId')
  @RequirePermission('settings:write')
  deleteZone(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('zoneId', UuidParam) zoneId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.deleteZone(store.id, zoneId, user, meta);
  }

  @Post('shipping-zones/:zoneId/rates')
  @RequirePermission('settings:write')
  @ApiZodBody(shippingRateInputSchema)
  addRate(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('zoneId', UuidParam) zoneId: string,
    @Body(new ZodPipe(shippingRateInputSchema)) body: RateInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.addRate(store.id, zoneId, body, user, meta);
  }

  @Delete('shipping-rates/:rateId')
  @RequirePermission('settings:write')
  deleteRate(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('rateId', UuidParam) rateId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.deleteRate(store.id, rateId, user, meta);
  }

  @Get('tax-rates')
  @RequirePermission('settings:read')
  taxRates(@CurrentStore() store: StoreContext): Promise<TaxRate[]> {
    return this.settings.listTaxRates(store.id);
  }

  @Put('tax-rates')
  @RequirePermission('settings:write')
  @ApiZodBody(taxRateInputSchema)
  saveTaxRate(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(taxRateInputSchema)) body: TaxInput,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.upsertTaxRate(store.id, body, user, meta);
  }

  @Delete('tax-rates/:rateId')
  @RequirePermission('settings:write')
  deleteTaxRate(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('rateId', UuidParam) rateId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.deleteTaxRate(store.id, rateId, user, meta);
  }

  @Get('discounts')
  @RequirePermission('discounts:write')
  discounts(@CurrentStore() store: StoreContext): Promise<Discount[]> {
    return this.settings.listDiscounts(store.id);
  }

  @Post('discounts')
  @RequirePermission('discounts:write')
  @ApiZodBody(discountInputSchema)
  createDiscount(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(discountInputSchema)) body: DiscountBody,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.createDiscount(store.id, body, user, meta);
  }

  @Patch('discounts/:discountId')
  @RequirePermission('discounts:write')
  @ApiZodBody(discountToggleSchema)
  toggleDiscount(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('discountId', UuidParam) discountId: string,
    @Body(new ZodPipe(discountToggleSchema)) body: z.output<typeof discountToggleSchema>,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.setDiscountActive(store.id, discountId, body.active, user, meta);
  }

  @Delete('discounts/:discountId')
  @HttpCode(204)
  @RequirePermission('discounts:write')
  deleteDiscount(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('discountId', UuidParam) discountId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.settings.deleteDiscount(store.id, discountId, user, meta);
  }
}
