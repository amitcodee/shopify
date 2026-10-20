import { type Dispute, type DisputeStatus, formatMoney } from '@repo/contracts';
import { Badge, type BadgeTone } from './ui';

const STATUS: Record<DisputeStatus, { label: string; tone: BadgeTone }> = {
  NEEDS_RESPONSE: { label: 'Needs response', tone: 'red' },
  UNDER_REVIEW: { label: 'Under review', tone: 'yellow' },
  WON: { label: 'Won', tone: 'green' },
  LOST: { label: 'Lost', tone: 'gray' },
};

export function DisputeBadge({ status }: { status: DisputeStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

/** One line per dispute: amount, reason, status and the evidence deadline. */
export function DisputeSummary({ dispute }: { dispute: Dispute }) {
  return (
    <span>
      {formatMoney(dispute.amount, dispute.currency)}
      {dispute.reason ? ` · ${dispute.reason.replaceAll('_', ' ')}` : ''}{' '}
      <DisputeBadge status={dispute.status} />
      {dispute.status === 'NEEDS_RESPONSE' && dispute.evidenceDueBy ? (
        <span className="ml-1 text-xs text-red-700">
          respond by {new Date(dispute.evidenceDueBy).toLocaleDateString()}
        </span>
      ) : null}
    </span>
  );
}
