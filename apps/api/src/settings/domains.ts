import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { addDomainInputSchema, type Domain as DomainDto } from '@repo/contracts';
import { type Domain, Prisma, type PrismaClient, setTenant } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { ENV, type Env } from '../config/env.js';
import { APP_DB } from '../database/database.module.js';
import { StoreResolver } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

/** Port for proving domain ownership (DNS TXT record). */
export interface DnsVerifier {
  hasTxtRecord(name: string, value: string): Promise<boolean>;
}
export const DNS_VERIFIER = Symbol('DNS_VERIFIER');

export class SystemDnsVerifier implements DnsVerifier {
  async hasTxtRecord(name: string, value: string): Promise<boolean> {
    try {
      const records = await resolveTxt(name);
      return records.some((chunks) => chunks.join('') === value);
    } catch {
      return false;
    }
  }
}

/** Development/test adapter: every record "exists" (no real DNS in local setups). */
export class MockDnsVerifier implements DnsVerifier {
  hasTxtRecord(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

const TXT_PREFIX = '_shop-verification';

@Injectable()
export class DomainsService {
  constructor(
    @Inject(APP_DB) private readonly db: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    @Inject(DNS_VERIFIER) private readonly dns: DnsVerifier,
    private readonly audit: AuditService,
    private readonly resolver: StoreResolver,
  ) {}

  async list(storeId: string): Promise<DomainDto[]> {
    const domains = await this.db.domain.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
    });
    return domains.map((d) => this.toDto(d));
  }

  async add(
    storeId: string,
    hostname: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<DomainDto> {
    const root = this.env.STOREFRONT_ROOT_DOMAIN.toLowerCase().replace(/:\d+$/, '');
    const underRoot = hostname === root || hostname.endsWith(`.${root}`);
    // Single-label names under the platform domain would collide with store subdomains.
    if (
      underRoot &&
      (this.env.NODE_ENV === 'production' ||
        hostname.split('.').length <= root.split('.').length + 1)
    ) {
      throw new BadRequestException('Use your own domain, not a platform subdomain.');
    }
    // Unverified claims do not block anyone (they would let a squatter lock out the real owner);
    // only a domain verified by another store does.
    if (await this.verifiedElsewhere(storeId, hostname)) {
      throw new ConflictException('This domain is already connected to another store.');
    }
    try {
      const domain = await this.db.$transaction(async (tx) => {
        const created = await tx.domain.create({
          data: {
            storeId,
            hostname,
            verificationToken: `shop-verify=${randomBytes(16).toString('hex')}`,
          },
        });
        await setTenant(tx, storeId);
        await this.audit.record(tx, {
          storeId,
          actorUserId: actor.id,
          action: 'domain.added',
          entityType: 'domain',
          entityId: created.id,
          data: { hostname },
          meta,
        });
        return created;
      });
      return this.toDto(domain);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This domain is already added to your store.');
      }
      throw error;
    }
  }

  async verify(
    storeId: string,
    domainId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<DomainDto> {
    const domain = await this.find(storeId, domainId);
    if (domain.verifiedAt) return this.toDto(domain);
    const ok = await this.dns.hasTxtRecord(
      `${TXT_PREFIX}.${domain.hostname}`,
      domain.verificationToken,
    );
    if (!ok) {
      throw new BadRequestException(
        'We could not find the TXT record yet. DNS changes can take a while — try again later.',
      );
    }
    if (await this.verifiedElsewhere(storeId, domain.hostname)) {
      throw new ConflictException('This domain is already connected to another store.');
    }
    const updated = await this.db
      .$transaction(async (tx) => {
        const hasPrimary = await tx.domain.count({ where: { storeId, isPrimary: true } });
        const result = await tx.domain.update({
          where: { id: domainId },
          data: { verifiedAt: new Date(), isPrimary: hasPrimary === 0 },
        });
        await setTenant(tx, storeId);
        await this.audit.record(tx, {
          storeId,
          actorUserId: actor.id,
          action: 'domain.verified',
          entityType: 'domain',
          entityId: domainId,
          data: { hostname: domain.hostname },
          meta,
        });
        return result;
      })
      .catch((error: unknown) => {
        // Partial unique index: at most one verified row per hostname (concurrent verifications).
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('This domain is already connected to another store.');
        }
        throw error;
      });
    this.resolver.invalidate();
    return this.toDto(updated);
  }

  async makePrimary(storeId: string, domainId: string): Promise<DomainDto> {
    const domain = await this.find(storeId, domainId);
    if (!domain.verifiedAt)
      throw new BadRequestException('Verify the domain before making it primary.');
    const updated = await this.db.$transaction(async (tx) => {
      await tx.domain.updateMany({
        where: { storeId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.domain.update({ where: { id: domainId }, data: { isPrimary: true } });
    });
    return this.toDto(updated);
  }

  async remove(
    storeId: string,
    domainId: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    const domain = await this.find(storeId, domainId);
    await this.db.$transaction(async (tx) => {
      await tx.domain.delete({ where: { id: domainId } });
      await setTenant(tx, storeId);
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'domain.removed',
        entityType: 'domain',
        entityId: domainId,
        data: { hostname: domain.hostname },
        meta,
      });
    });
    this.resolver.invalidate();
  }

  /** Domain is a global (non-RLS) table, so the cross-store check is a plain query. */
  private async verifiedElsewhere(storeId: string, hostname: string): Promise<boolean> {
    const count = await this.db.domain.count({
      where: { hostname, verifiedAt: { not: null }, storeId: { not: storeId } },
    });
    return count > 0;
  }

  private async find(storeId: string, domainId: string): Promise<Domain> {
    const domain = await this.db.domain.findFirst({ where: { id: domainId, storeId } });
    if (!domain) throw new NotFoundException('Domain not found.');
    return domain;
  }

  private toDto(d: Domain): DomainDto {
    return {
      id: d.id,
      hostname: d.hostname,
      verified: d.verifiedAt !== null,
      isPrimary: d.isPrimary,
      verificationRecord: {
        type: 'TXT',
        name: `${TXT_PREFIX}.${d.hostname}`,
        value: d.verificationToken,
      },
      routingRecord: { type: 'CNAME', name: d.hostname, value: this.env.PLATFORM_CNAME_TARGET },
      createdAt: d.createdAt.toISOString(),
    };
  }
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/domains')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @RequirePermission('settings:read')
  list(@CurrentStore() store: StoreContext): Promise<DomainDto[]> {
    return this.domains.list(store.id);
  }

  @Post()
  @RequirePermission('settings:write')
  @ApiZodBody(addDomainInputSchema)
  add(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(addDomainInputSchema)) body: z.output<typeof addDomainInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<DomainDto> {
    return this.domains.add(store.id, body.hostname, user, meta);
  }

  @Post(':domainId/verify')
  @HttpCode(200)
  @RequirePermission('settings:write')
  verify(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('domainId', UuidParam) domainId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<DomainDto> {
    return this.domains.verify(store.id, domainId, user, meta);
  }

  @Post(':domainId/primary')
  @HttpCode(200)
  @RequirePermission('settings:write')
  primary(
    @CurrentStore() store: StoreContext,
    @Param('domainId', UuidParam) domainId: string,
  ): Promise<DomainDto> {
    return this.domains.makePrimary(store.id, domainId);
  }

  @Delete(':domainId')
  @HttpCode(204)
  @RequirePermission('settings:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('domainId', UuidParam) domainId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.domains.remove(store.id, domainId, user, meta);
  }
}
