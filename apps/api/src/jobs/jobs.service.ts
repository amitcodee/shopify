import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { CheckoutRecoveryService } from '../checkout/checkout-recovery.service.js';
import { reportError } from '../common/error-reporting.js';
import { ENV, type Env, shouldRunJobs } from '../config/env.js';
import { OrderLifecycle } from '../orders/order-lifecycle.service.js';
import { OutboxProcessor } from '../outbox/outbox.service.js';
import { BillingService } from '../platform/billing.service.js';
import { StoreClosureService } from '../stores/store-closure.service.js';
import { WebhooksService } from '../webhooks/webhooks.service.js';
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
    private readonly recovery: CheckoutRecoveryService,
    private readonly webhooks: WebhooksService,
    private readonly closures: StoreClosureService,
  ) {}

  onApplicationBootstrap(): void {
    if (!shouldRunJobs(this.env)) return;
    this.every('outbox', 2_000, () => this.outbox.processBatch());
    this.every('webhooks', 5_000, () => this.webhooks.deliverDue());
    this.every('expire-orders', 60_000, () => this.lifecycle.expireStaleOrders());
    this.every('checkout-recovery', 5 * 60_000, () => this.recovery.sendDue());
    // Trials end, renewals land and grace periods run out on their own schedule: check often.
    this.every('billing', 10 * 60_000, () => this.billing.renewDue());
    this.every('cleanup', 24 * 60 * 60_000, () => this.maintenance.cleanup());
    this.every('erase-closed-stores', 6 * 60 * 60_000, () => this.closures.purgeDue());
    this.logger.log(
      'Background jobs started (outbox, webhooks, unpaid order expiry, checkout recovery, billing, closed-store erasure)',
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
        .catch((error: unknown) => {
          this.logger.error(`Job ${name} failed: ${String(error)}`);
          reportError(error, { job: name });
        })
        .finally(() => this.running.delete(name));
    }, ms);
    timer.unref();
    this.timers.push(timer);
  }
}
