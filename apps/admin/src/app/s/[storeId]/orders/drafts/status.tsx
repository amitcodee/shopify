import type { DraftOrderStatus } from '@repo/contracts';
import { Badge, type BadgeTone } from '@/components/ui';

const STATUS: Record<DraftOrderStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'open', tone: 'gray' },
  INVOICE_SENT: { label: 'invoice sent', tone: 'blue' },
  COMPLETED: { label: 'completed', tone: 'green' },
};

export function DraftStatusBadge({ status }: { status: DraftOrderStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}
