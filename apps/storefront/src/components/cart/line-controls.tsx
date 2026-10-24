'use client';

import type { CartLine } from '@repo/contracts';
import { useState, useSyncExternalStore, useTransition } from 'react';
import { removeLineAction, updateLineAction } from '@/app/(store)/cart/actions';
import { MinusIcon, PlusIcon } from '@/components/header/icons';

const subscribeNothing = () => () => {};

/**
 * Quantity stepper, "Update" and "Remove" for one cart line, shared by the cart page and the
 * drawer. The forms post to the cart server actions, so the page also works without scripts;
 * with scripts the − / + buttons apply straight away and "Update" only shows once a typed
 * quantity differs. Key it on the quantity so it resets when the cart changes.
 */
export function CartLineControls({
  line,
  compact = false,
}: {
  line: CartLine;
  /** Drawer layout: smaller controls. */
  compact?: boolean;
}) {
  const [value, setValue] = useState(String(line.quantity));
  const [pending, startTransition] = useTransition();
  const max = line.maxQuantity ?? 99;
  const dirty = value !== String(line.quantity);
  // Before hydration (or without scripts) "Update" is the only way to apply a typed quantity.
  const hydrated = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const inputId = `${compact ? 'drawer-' : ''}qty-${line.id}`;

  function setQuantity(quantity: number) {
    startTransition(async () => {
      if (quantity <= 0) {
        await removeLineAction(line.id);
        return;
      }
      const data = new FormData();
      data.set('quantity', String(quantity));
      await updateLineAction(line.id, data);
    });
  }

  const step = compact ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <div
      aria-busy={pending || undefined}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 transition-opacity ${pending ? 'opacity-60' : ''}`}
    >
      <form action={updateLineAction.bind(null, line.id)} className="flex items-center gap-3">
        <div className="qty-stepper inline-flex items-center rounded-md border border-zinc-300">
          <button
            type="button"
            onClick={() => setQuantity(line.quantity - 1)}
            disabled={pending}
            aria-label={`One fewer ${line.productTitle}`}
            className={`inline-flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-950 disabled:opacity-40 ${step}`}
          >
            <MinusIcon />
          </button>
          <label htmlFor={inputId} className="sr-only">
            {compact ? `Qty for ${line.productTitle}` : 'Qty'}
          </label>
          <input
            id={inputId}
            name="quantity"
            type="number"
            inputMode="numeric"
            min={0}
            max={max}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`qty-input bg-transparent text-center text-sm font-medium tabular-nums focus:outline-none ${compact ? 'h-8 w-9' : 'h-10 w-11'}`}
          />
          <button
            type="button"
            onClick={() => setQuantity(line.quantity + 1)}
            disabled={pending || line.quantity >= max || !line.available}
            aria-label={`One more ${line.productTitle}`}
            className={`inline-flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-950 disabled:opacity-40 ${step}`}
          >
            <PlusIcon />
          </button>
        </div>
        <button
          type="submit"
          hidden={hydrated && !dirty}
          className="text-sm font-medium underline underline-offset-4"
        >
          Update
        </button>
      </form>
      <form action={removeLineAction.bind(null, line.id)}>
        <button
          type="submit"
          className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900"
        >
          Remove
        </button>
      </form>
    </div>
  );
}
