import type { GiftCardStatus } from '@repo/contracts';
import { Badge, type BadgeTone } from '@/components/ui';

const TONES: Record<GiftCardStatus, BadgeTone> = {
  active: 'green',
  spent: 'gray',
  expired: 'yellow',
  disabled: 'red',
};

export function GiftCardStatusBadge({ status }: { status: GiftCardStatus }) {
  return <Badge tone={TONES[status]}>{status}</Badge>;
}
