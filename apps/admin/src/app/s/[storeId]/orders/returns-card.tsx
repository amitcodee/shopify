import {
  minorToDecimalString,
  type OrderDetail,
  RETURN_REASON_LABELS,
  RETURN_REASONS,
} from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SelectField, SubmitButton } from '@/components/form';
import { Badge, type BadgeTone, Card, formatDateTime } from '@/components/ui';
import { SmallAction } from '../settings/small-action';
import {
  approveReturnAction,
  closeReturnAction,
  createReturnAction,
  declineReturnAction,
} from './return-actions';

const TONES: Record<OrderDetail['returns'][number]['status'], BadgeTone> = {
  REQUESTED: 'yellow',
  OPEN: 'blue',
  DECLINED: 'gray',
  CLOSED: 'green',
};

export function ReturnsCard({
  order,
  storeId,
  canWrite,
  money,
}: {
  order: OrderDetail;
  storeId: string;
  canWrite: boolean;
  money: (n: number) => string;
}) {
  const paid = order.financialStatus === 'PAID' || order.financialStatus === 'PARTIALLY_REFUNDED';
  if (order.returns.length === 0 && !(canWrite && paid)) return null;
  return (
    <Card title="Returns">
      <div className="space-y-4">
        {order.returns.map((r) => (
          <div key={r.id} className="rounded-md border border-slate-200 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>
                <Badge tone={TONES[r.status]}>{r.status.toLowerCase()}</Badge>{' '}
                <span className="text-slate-500">
                  {r.requestedByCustomer ? 'by customer' : 'by staff'} ·{' '}
                  {formatDateTime(r.createdAt)}
                </span>
              </span>
              <span className="text-slate-600">≈ {money(r.suggestedRefund)}</span>
            </div>
            <ul className="mt-2 text-slate-700">
              {r.lines.map((l) => (
                <li key={l.orderLineId}>
                  {l.title} × {l.quantity} — {RETURN_REASON_LABELS[l.reason]}
                </li>
              ))}
            </ul>
            {r.customerNote ? <p className="mt-1 text-slate-500">“{r.customerNote}”</p> : null}
            {r.declineReason ? (
              <p className="mt-1 text-slate-500">Declined: {r.declineReason}</p>
            ) : null}
            {canWrite && r.status === 'REQUESTED' ? (
              <div className="mt-3 space-y-2">
                <SmallAction
                  action={approveReturnAction.bind(null, storeId, order.id, r.id)}
                  label="Approve return"
                />
                <ActionForm
                  action={declineReturnAction.bind(null, storeId, order.id, r.id)}
                  className="flex items-end gap-2"
                >
                  <Field name="reason" label="Decline reason" maxLength={500} />
                  <SubmitButton variant="secondary">Decline</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
            {canWrite && r.status === 'OPEN' ? (
              <ActionForm
                action={closeReturnAction.bind(null, storeId, order.id, r.id, order.currency)}
                className="mt-3 space-y-2"
              >
                <Field
                  name="amount"
                  label={`Refund (${order.currency})`}
                  inputMode="decimal"
                  defaultValue={minorToDecimalString(
                    Math.min(r.suggestedRefund, order.refundableAmount),
                    order.currency,
                  )}
                  hint="Items' price after discounts, plus their tax. Shipping is not included."
                />
                <CheckboxField name="restock" label="Return items to stock" defaultChecked />
                <SubmitButton>Receive and refund</SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        ))}
        {canWrite && paid ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-brand-600">Create a return</summary>
            <ActionForm
              action={createReturnAction.bind(null, storeId, order.id)}
              className="mt-3 space-y-2"
            >
              {order.lines.map((l) => (
                <Field
                  key={l.id}
                  name={`return-qty-${l.id}`}
                  label={`${l.title} (bought ${l.quantity})`}
                  type="number"
                  min={0}
                  max={l.quantity}
                  defaultValue={0}
                />
              ))}
              <SelectField
                name="reason"
                label="Reason"
                options={RETURN_REASONS.map((r) => ({ value: r, label: RETURN_REASON_LABELS[r] }))}
              />
              <SubmitButton variant="secondary">Create return</SubmitButton>
            </ActionForm>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
