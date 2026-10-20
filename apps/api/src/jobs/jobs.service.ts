import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ENV, type Env, shouldRunJobs } from '../config/env.js';
import { OrderLifecycle } from '../orders/order-lifecycle.service.js';
import { OutboxProcessor } from '../outbox/outbox.service.js';
import { BillingService } from '../platform/billing.service.js';
import { MaintenanceService } from './maintenance.service.js';

/**
 * In-process scheduler for background work (see ADR 0003). Each job is guarded against
 * overlapping runs; several processes can run it safely (SKIP LOCKED / idempotent transitions).
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Set<string>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly outbox: OutboxProcessor,
    private readonly lifecycle: OrderLifecycle,
    private readonly billing: BillingService,
    private readonly maintenance: MaintenanceService,
  ) {}

  onApplicationBootstrap(): void {
    if (!shouldRunJobs(this.env)) return;
    this.every('outbox', 2_000, () => this.outbox.processBatch());
    this.every('expire-orders', 60_000, () => this.lifecycle.expireStaleOrders());
    this.every('renew-subscriptions', 60 * 60_000, () => this.billing.renewDue());
    this.every('cleanup', 24 * 60 * 60_000, () => this.maintenance.cleanup());
    this.logger.log(
      'Background jobs started (outbox delivery, unpaid order expiry, subscription renewals)',
    );
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearInterval(timer);
  }

  private every(name: string, ms: number, job: () => Promise<unknown>): void {
    const timer = setInterval(() => {
      if (this.running.has(name)) return;
      this.running.add(name);
      job()
        .catch((error: unknown) => this.logger.error(`Job ${name} failed: ${String(error)}`))
        .finally(() => this.running.delete(name));
    }, ms);
    timer.unref();
    this.timers.push(timer);
  }
}
