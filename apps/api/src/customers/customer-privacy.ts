import {
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { TenantDb } from '../database/database.module.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

const REDACTED = '[redacted]';

/**
 * Data-subject requests (GDPR/CCPA style): export everything a store holds about a customer,
 * or redact their personal data. Orders are kept for accounting with PII replaced.
 */
@Injectable()
export class CustomerPrivacyService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  async export(store: StoreContext, customerId: string, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(store.id, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, storeId: store.id },
        include: { orders: { include: { lines: true, fulfillments: true, refunds: true } } },
      });
      if (!customer) throw new NotFoundException('Customer not found.');
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'customer.exported',
        entityType: 'customer',
        entityId: customerId,
        meta,
      });
      const { passwordHash: _passwordHash, ...profile } = customer;
      return {
        exportedAt: new Date().toISOString(),
        customer: { ...profile, hasPassword: customer.passwordHash !== null },
      };
    });
  }

  async redact(
    store: StoreContext,
    customerId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    await this.tenantDb.run(store.id, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, storeId: store.id },
      });
      if (!customer) throw new NotFoundException('Customer not found.');
      const open = await tx.order.count({
        where: { storeId: store.id, customerId, status: 'OPEN', fulfillmentStatus: 'UNFULFILLED' },
      });
      if (open > 0)
        throw new ConflictException('Fulfil or cancel open orders before redacting this customer.');

      const anonymousEmail = `redacted+${customer.id}@invalid`;
      const orders = await tx.order.findMany({
        where: { storeId: store.id, customerId },
        select: { id: true, shippingAddress: true },
      });
      for (const order of orders) {
        const address = order.shippingAddress as Record<string, unknown>;
        await tx.order.update({
          where: { id: order.id },
          data: {
            email: anonymousEmail,
            note: null,
            shippingAddress: {
              name: REDACTED,
              line1: REDACTED,
              city: REDACTED,
              postalCode: REDACTED,
              country: typeof address.country === 'string' ? address.country : 'XX',
            },
          },
        });
      }
      // Never send an abandoned-checkout email for a redacted customer.
      await tx.order.updateMany({
        where: { storeId: store.id, customerId, recoveryStatus: null },
        data: { recoveryStatus: 'SKIPPED' },
      });
      await tx.customerSession.deleteMany({ where: { customerId, storeId: store.id } });
      await tx.customerToken.deleteMany({ where: { customerId, storeId: store.id } });
      await tx.customer.update({
        where: { id: customerId },
        data: {
          email: anonymousEmail,
          name: null,
          passwordHash: null,
          acceptsMarketing: false,
          disabledAt: new Date(),
        },
      });
      await this.audit.record(tx, {
        storeId: store.id,
        actorUserId: actor.id,
        action: 'customer.redacted',
        entityType: 'customer',
        entityId: customerId,
        data: { orders: orders.length },
        meta,
      });
    });
  }
}

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/customers/:customerId')
export class CustomerPrivacyController {
  constructor(private readonly privacy: CustomerPrivacyService) {}

  @Get('export')
  @RequirePermission('customers:write')
  export(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('customerId', UuidParam) customerId: string,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.privacy.export(store, customerId, user, meta);
  }

  @Post('redact')
  @HttpCode(204)
  @RequirePermission('customers:write')
  redact(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('customerId', UuidParam) customerId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.privacy.redact(store, customerId, user, meta);
  }
}
