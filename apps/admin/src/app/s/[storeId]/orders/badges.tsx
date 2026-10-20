import type { FinancialStatus, FulfillmentStatus, OrderStatus } from '@repo/contracts';
import { Badge, type BadgeTone } from '@/components/ui';

const FINANCIAL: Record<FinancialStatus, [string, BadgeTone]> = {
  PENDING: ['Payment pending', 'yellow'],
  PAID: ['Paid', 'green'],
  PARTIALLY_REFUNDED: ['Partially refunded', 'blue'],
  REFUNDED: ['Refunded', 'gray'],
  VOIDED: ['Voided', 'gray'],
};

export function FinancialBadge({ status }: { status: FinancialStatus }) {
  const [label, tone] = FINANCIAL[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function FulfillmentBadge({ status }: { status: FulfillmentStatus }) {
  return status === 'FULFILLED' ? (
    <Badge tone="green">Fulfilled</Badge>
  ) : (
    <Badge tone="yellow">Unfulfilled</Badge>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') return <Badge tone="red">Cancelled</Badge>;
  if (status === 'PENDING_PAYMENT') return <Badge tone="gray">Awaiting payment</Badge>;
  return null;
}
