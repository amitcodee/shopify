import { randomBytes } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
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
import {
  addDomainInputSchema,
  type DnsRecordStatus,
  type Domain as DomainDto,
  type DomainCheck,
} from '@repo/contracts';
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

/** Port for reading public DNS. Lookups that fail or find nothing answer with an empty list. */
export interface DnsVerifier {
  /** Answers are made up rather than looked up (local development). */
  readonly simulated: boolean;
  hasTxtRecord(name: string, value: string): Promise<boolean>;
  txt(name: string): Promise<string[]>;
  cname(name: string): Promise<string[]>;
  a(name: string): Promise<string[]>;
  ns(name: string): Promise<string[]>;
}
export const DNS_VERIFIER = Symbol('DNS_VERIFIER');

export class SystemDnsVerifier implements DnsVerifier {
  readonly simulated = false;
  // Public resolvers, so a merchant's record shows up as soon as it is live on the internet.
  private readonly resolver = new Resolver({ timeout: 3000, tries: 2 });

  constructor() {
    this.resolver.setServers(['1.1.1.1', '8.8.8.8']);
  }

  private async answer(lookup: () => Promise<string[]>): Promise<string[]> {
    try {
      return await lookup();
    } catch {
      return [];
    }
  }

  async hasTxtRecord(name: string, value: string): Promise<boolean> {
    return (await this.txt(name)).includes(value);
  }

  txt(name: string): Promise<string[]> {
    return this.answer(async () =>
      (await this.resolver.resolveTxt(name)).map((chunks) => chunks.join('')),
    );
  }

  cname(name: string): Promise<string[]> {
    return this.answer(() => this.resolver.resolveCname(name));
  }

  a(name: string): Promise<string[]> {
    return this.answer(() => this.resolver.resolve4(name));
  }

  ns(name: string): Promise<string[]> {
    return this.answer(() => this.resolver.resolveNs(name));
  }
}

/** Development/test adapter: every record "exists" (no real DNS in local setups). */
export class MockDnsVerifier implements DnsVerifier {
  readonly simulated = true;

  hasTxtRecord(): Promise<boolean> {
    return Promise.resolve(true);
  }

  txt(): Promise<string[]> {
    return Promise.resolve([]);
  }

  cname(): Promise<string[]> {
    return Promise.resolve([]);
  }

  a(): Promise<string[]> {
    return Promise.resolve([]);
  }

  ns(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

const TXT_PREFIX = '_shop-verification';

/** Common public suffixes of two labels, so the zone of shop.example.co.in is example.co.in. */
const TWO_LABEL_SUFFIXES = new Set([
  'co.in',
  'net.in',
  'org.in',
  'firm.in',
  'gen.in',
  'ind.in',
  'ac.in',
  'edu.in',
  'gov.in',
  'co.uk',
  'org.uk',
  'me.uk',
  'ac.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'org.nz',
  'net.nz',
  'com.sg',
  'com.my',
  'co.za',
  'com.br',
  'com.mx',
  'co.jp',
  'co.kr',
  'com.hk',
  'com.tr',
  'com.ae',
  'co.ae',
  'com.sa',
  'com.pk',
  'com.bd',
  'com.np',
  'com.lk',
]);

/** The domain a merchant actually registered, e.g. example.com for shop.example.com. */
export function zoneOf(hostname: string): string {
  const labels = hostname.split('.');
  const size = TWO_LABEL_SUFFIXES.has(labels.slice(-2).join('.')) ? 3 : 2;
  return labels.slice(-size).join('.');
}

/** The record's name as DNS dashboards ask for it: relative to the zone, "@" for the zone itself. */
function hostIn(name: string, zone: string): string {
  return name === zone ? '@' : name.slice(0, -(zone.length + 1));
}

/** Who hosts the DNS, recognised from nameserver hostnames. */
const DNS_HOSTS: [string, string][] = [
  ['domaincontrol.com', 'GoDaddy'],
  ['registrar-servers.com', 'Namecheap'],
  ['cloudflare.com', 'Cloudflare'],
  ['dns-parking.com', 'Hostinger'],
  ['hostinger.com', 'Hostinger'],
  ['awsdns', 'Amazon Route 53'],
  ['googledomains.com', 'Google'],
  ['ns-cloud', 'Google Cloud DNS'],
  ['azure-dns', 'Azure DNS'],
  ['digitalocean.com', 'DigitalOcean'],
  ['wixdns.net', 'Wix'],
  ['squarespacedns.com', 'Squarespace'],
  ['vercel-dns.com', 'Vercel'],
  ['nsone.net', 'NS1'],
];

const sameName = (a: string, b: string) =>
  a.toLowerCase().replace(/\.$/, '') === b.toLowerCase().replace(/\.$/, '');

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

  /** Reads the domain's records from public DNS, so the merchant sees what is still missing. */
  async check(storeId: string, domainId: string): Promise<DomainCheck> {
    const domain = this.toDto(await this.find(storeId, domainId));
    const verifiedRow = domain.verified;
    if (this.dns.simulated) {
      return {
        simulated: true,
        dnsProvider: null,
        nameservers: [],
        verification: { status: verifiedRow ? 'found' : 'missing', found: [] },
        routing: { status: 'missing', found: [] },
      };
    }
    const { verificationRecord: txt, routingRecord: route } = domain;
    const [txtFound, nameservers, cnames, addresses] = await Promise.all([
      this.dns.txt(txt.name),
      this.dns.ns(domain.zone),
      this.dns.cname(route.name),
      this.dns.a(route.name),
    ]);
    const verificationStatus: DnsRecordStatus = txtFound.includes(txt.value)
      ? 'found'
      : txtFound.length > 0
        ? 'wrong'
        : 'missing';
    let routing: DomainCheck['routing'];
    if (route.type === 'A') {
      routing = {
        status: addresses.includes(route.value)
          ? 'found'
          : addresses.length > 0
            ? 'wrong'
            : 'missing',
        found: addresses,
      };
    } else if (route.type === 'CNAME' && cnames.length > 0) {
      routing = {
        status: cnames.some((c) => sameName(c, route.value)) ? 'found' : 'wrong',
        found: cnames,
      };
    } else if (addresses.length > 0) {
      // Flattened or proxied: compare with where the platform's own address points.
      const target = await this.dns.a(route.value);
      routing = {
        status: addresses.some((a) => target.includes(a)) ? 'found' : 'wrong',
        found: addresses,
      };
    } else {
      routing = { status: 'missing', found: [] };
    }
    const host = nameservers.join(' ').toLowerCase();
    return {
      simulated: false,
      dnsProvider: DNS_HOSTS.find(([part]) => host.includes(part))?.[1] ?? null,
      nameservers,
      verification: { status: verificationStatus, found: txtFound },
      routing,
    };
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
      const found = await this.dns.txt(`${TXT_PREFIX}.${domain.hostname}`);
      throw new BadRequestException(
        found.length > 0
          ? 'We found a TXT record at that name, but its value does not match. Check for extra spaces or quotes.'
          : 'We could not find the TXT record yet. DNS changes can take up to a few hours — try again later.',
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
    const zone = zoneOf(d.hostname);
    const apex = d.hostname === zone;
    const txtName = `${TXT_PREFIX}.${d.hostname}`;
    const apexIp = this.env.PLATFORM_APEX_IP;
    return {
      id: d.id,
      hostname: d.hostname,
      verified: d.verifiedAt !== null,
      isPrimary: d.isPrimary,
      apex,
      zone,
      verificationRecord: {
        type: 'TXT',
        name: txtName,
        host: hostIn(txtName, zone),
        value: d.verificationToken,
      },
      routingRecord: {
        // A CNAME cannot sit at a bare domain. Use the platform's address, or the provider's
        // ALIAS/ANAME/flattened record when there is no fixed address.
        type: apex ? (apexIp ? 'A' : 'ALIAS') : 'CNAME',
        name: d.hostname,
        host: hostIn(d.hostname, zone),
        value: apex && apexIp ? apexIp : this.env.PLATFORM_CNAME_TARGET,
      },
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

  @Get(':domainId/check')
  @RequirePermission('settings:read')
  check(
    @CurrentStore() store: StoreContext,
    @Param('domainId', UuidParam) domainId: string,
  ): Promise<DomainCheck> {
    return this.domains.check(store.id, domainId);
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
