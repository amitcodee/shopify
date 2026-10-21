'use client';

import { type PublicOrder, RETURN_REASON_LABELS, RETURN_REASONS } from '@repo/contracts';
import { useActionState } from 'react';
import { Notice, Submit } from '@/components/form';
import { requestReturnAction } from './actions';

const STATUS: Record<PublicOrder['returns'][number]['status'], string> = {
  REQUESTED: 'Requested — waiting for the store',
  OPEN: 'Approved — please send the items back',
  DECLINED: 'Declined',
  CLOSED: 'Received and closed',
};

export function Returns({ order }: { order: PublicOrder }) {
  const [state, formAction] = useActionState(
    requestReturnAction.bind(null, order.number),
    undefined,
  );
  const lines = order.lines.filter((l) => l.returnableQuantity > 0);
  return (
    <section aria-labelledby="returns-heading" className="mt-10 space-y-4">
      <h2 id="returns-heading" className="text-lg font-semibold">
        Returns
      </h2>
      {order.returns.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {order.returns.map((r, i) => (
            <li key={i} className="rounded-md border border-zinc-200 p-3">
              <p className="font-medium">{STATUS[r.status]}</p>
              <p className="text-zinc-600">
                {r.lines.map((l) => `${l.title} × ${l.quantity}`).join(', ')}
              </p>
              {r.declineReason ? <p className="text-zinc-600">{r.declineReason}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {order.returnable && lines.length > 0 ? (
        <form action={formAction} className="space-y-4 rounded-xl border border-zinc-200 p-5">
          <Notice result={state} />
          <p className="text-sm text-zinc-600">Choose what you would like to return.</p>
          {lines.map((l) => (
            <fieldset key={l.id} className="grid gap-2 sm:grid-cols-[1fr_6rem_12rem] sm:items-end">
              <legend className="sr-only">{l.title}</legend>
              <p className="text-sm">
                {l.title}
                {l.variantTitle !== 'Default' ? ` · ${l.variantTitle}` : ''}
              </p>
              <label className="text-xs text-zinc-600">
                Quantity
                <select
                  name={`qty-${l.id}`}
                  defaultValue="0"
                  aria-label={`Quantity of ${l.title} to return`}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  {Array.from({ length: l.returnableQuantity + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Reason
                <select
                  name={`reason-${l.id}`}
                  aria-label={`Reason for returning ${l.title}`}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {RETURN_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ))}
          <label className="block text-sm">
            Anything else we should know? (optional)
            <textarea
              name="note"
              rows={2}
              maxLength={1000}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <Submit pendingLabel="Sending…">Request a return</Submit>
        </form>
      ) : null}
    </section>
  );
}
