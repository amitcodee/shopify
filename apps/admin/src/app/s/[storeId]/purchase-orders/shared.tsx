import type { PurchaseOrderStatus } from '@repo/contracts';
import { type BadgeTone, Badge, UnderlineTabs } from '@/components/ui';

export const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
};

const STATUS_TONE: Record<PurchaseOrderStatus, BadgeTone> = {
  DRAFT: 'gray',
  ORDERED: 'blue',
  PARTIALLY_RECEIVED: 'yellow',
  RECEIVED: 'green',
  CANCELLED: 'gray',
};

export function PurchaseOrderStatusBadge({
  status,
  overdue,
}: {
  status: PurchaseOrderStatus;
  overdue?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      {overdue ? <Badge tone="red">Overdue</Badge> : null}
    </span>
  );
}

/** "Purchase orders | Suppliers" section tabs. */
export function PurchasingTabs({
  storeId,
  active,
}: {
  storeId: string;
  active: 'orders' | 'suppliers';
}) {
  return (
    <div className="mb-6">
      <UnderlineTabs
        label="Purchasing"
        items={[
          {
            label: 'Purchase orders',
            href: `/s/${storeId}/purchase-orders`,
            active: active === 'orders',
          },
          {
            label: 'Suppliers',
            href: `/s/${storeId}/purchase-orders/suppliers`,
            active: active === 'suppliers',
          },
        ]}
      />
    </div>
  );
}

/** "Mar 4, 2026" for a YYYY-MM-DD date (no time zone shift). */
export function formatDay(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
