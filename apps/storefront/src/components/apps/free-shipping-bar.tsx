import { formatMoney, type StoreApps } from '@repo/contracts';

/**
 * The Free shipping bar app: progress toward the merchant's free-shipping amount. Shown only
 * when the cart is in the store currency (the threshold is set in it).
 */
export function FreeShippingBar({
  app,
  subtotal,
  currency,
  baseCurrency,
}: {
  app: StoreApps['freeShippingBar'];
  subtotal: number;
  currency: string;
  baseCurrency: string;
}) {
  if (!app.enabled || currency !== baseCurrency || subtotal <= 0) return null;
  const remaining = Math.max(0, app.threshold - subtotal);
  const progress = Math.min(100, Math.round((subtotal / app.threshold) * 100));
  const message =
    remaining === 0
      ? app.successMessage
      : app.message.replace('{amount}', formatMoney(remaining, currency));
  return (
    <div className="rounded-md bg-surface px-3 py-2.5 text-sm" role="status">
      <p className="font-medium text-zinc-800">{message}</p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-label="Progress to free shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
