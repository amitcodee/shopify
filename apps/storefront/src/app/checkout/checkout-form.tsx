'use client';

import { type CheckoutPreview, formatMoney } from '@repo/contracts';
import { useActionState, useState, useTransition } from 'react';
import { FollowRedirect } from '@/components/follow-redirect';
import { Notice, Submit, TextField } from '@/components/form';
import { placeOrderAction, previewAction } from './actions';

const COUNTRIES: [string, string][] = [
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['IN', 'India'],
  ['JP', 'Japan'],
];

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-base font-semibold' : 'text-sm'}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function CheckoutForm({
  initial,
  idempotencyKey,
  email,
}: {
  initial: CheckoutPreview;
  idempotencyKey: string;
  email: string | null;
}) {
  const [state, formAction] = useActionState(placeOrderAction, undefined);
  const [preview, setPreview] = useState(initial);
  const [country, setCountry] = useState('US');
  const [region, setRegion] = useState('');
  const [shippingRateId, setShippingRateId] = useState(initial.selectedShippingRateId ?? '');
  const [discountCode, setDiscountCode] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const money = (n: number) => formatMoney(n, preview.currency);
  const err = state?.fieldErrors ?? {};

  function refresh(next: {
    country?: string;
    region?: string;
    shippingRateId?: string;
    discountCode?: string;
  }) {
    const input = { country, region, shippingRateId, discountCode, ...next };
    startTransition(async () => {
      const result = await previewAction(input);
      if (result.preview) {
        setPreview(result.preview);
        setShippingRateId(result.preview.selectedShippingRateId ?? '');
        setPreviewError(null);
      } else {
        setPreviewError(result.error ?? 'Could not update totals.');
      }
    });
  }

  return (
    <form action={formAction} className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <FollowRedirect to={state?.redirectTo} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="shippingRateId" value={shippingRateId} />
      <input
        type="hidden"
        name="discountCode"
        value={preview.discount?.applied ? preview.discount.code : ''}
      />

      <div className="space-y-8">
        <Notice result={state} />
        <section className="space-y-4" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-lg font-semibold">
            Contact
          </h2>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={email ?? ''}
            readOnly={Boolean(email)}
            error={err.email}
          />
        </section>

        <section className="space-y-4" aria-labelledby="shipping-heading">
          <h2 id="shipping-heading" className="text-lg font-semibold">
            Shipping address
          </h2>
          <TextField label="Full name" name="name" autoComplete="name" required error={err.name} />
          <TextField
            label="Address"
            name="line1"
            autoComplete="address-line1"
            required
            error={err.line1}
          />
          <TextField
            label="Apartment, suite, etc. (optional)"
            name="line2"
            autoComplete="address-line2"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="City"
              name="city"
              autoComplete="address-level2"
              required
              error={err.city}
            />
            <TextField
              label="State / region"
              name="region"
              autoComplete="address-level1"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              onBlur={() => refresh({ region })}
            />
            <TextField
              label="Postal code"
              name="postalCode"
              autoComplete="postal-code"
              required
              error={err.postalCode}
            />
            <div className="space-y-1">
              <label htmlFor="country" className="block text-sm font-medium text-zinc-800">
                Country
              </label>
              <select
                id="country"
                name="country"
                autoComplete="country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  refresh({ country: e.target.value });
                }}
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <TextField label="Phone (optional)" name="phone" type="tel" autoComplete="tel" />
        </section>

        {preview.requiresShipping ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-lg font-semibold">Shipping method</legend>
            {preview.shippingOptions.length === 0 ? (
              <p className="text-sm text-red-700">We don’t ship to this country yet.</p>
            ) : (
              preview.shippingOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center justify-between rounded-md border border-zinc-300 px-4 py-3 text-sm has-[:checked]:border-zinc-900"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingOption"
                      value={option.id}
                      checked={shippingRateId === option.id}
                      onChange={() => {
                        setShippingRateId(option.id);
                        refresh({ shippingRateId: option.id });
                      }}
                    />
                    {option.name}
                  </span>
                  <span>{option.price === 0 ? 'Free' : money(option.price)}</span>
                </label>
              ))
            )}
          </fieldset>
        ) : null}

        <div className="space-y-1">
          <label htmlFor="note" className="block text-sm font-medium text-zinc-800">
            Order note (optional)
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={500}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <aside
        aria-labelledby="summary-heading"
        className="h-fit space-y-5 rounded-xl bg-zinc-50 p-6"
      >
        <h2 id="summary-heading" className="text-lg font-semibold">
          Order summary
        </h2>
        <ul className="space-y-3 text-sm">
          {preview.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-4">
              <span>
                {line.productTitle}
                {line.variantTitle !== 'Default' ? ` · ${line.variantTitle}` : ''} × {line.quantity}
              </span>
              <span>{money(line.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <label htmlFor="discount" className="block text-sm font-medium text-zinc-800">
            Discount code
          </label>
          <div className="flex gap-2">
            <input
              id="discount"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase"
            />
            <button
              type="button"
              onClick={() => refresh({ discountCode })}
              className="rounded-md border border-zinc-900 px-3 py-2 text-sm font-medium"
            >
              Apply
            </button>
          </div>
          {preview.discount ? (
            <p
              className={`text-xs ${preview.discount.applied ? 'text-emerald-700' : 'text-red-700'}`}
              role="status"
            >
              {preview.discount.applied
                ? `Code ${preview.discount.code} applied.`
                : preview.discount.message}
            </p>
          ) : null}
        </div>

        <dl
          className="space-y-2 border-t border-zinc-200 pt-4"
          aria-live="polite"
          aria-busy={isPending}
        >
          <Row label="Subtotal" value={money(preview.subtotal)} />
          {preview.discountTotal > 0 ? (
            <Row label="Discount" value={`−${money(preview.discountTotal)}`} />
          ) : null}
          <Row
            label="Shipping"
            value={
              preview.requiresShipping
                ? preview.shippingTotal === 0
                  ? 'Free'
                  : money(preview.shippingTotal)
                : '—'
            }
          />
          <Row label="Tax" value={money(preview.taxTotal)} />
          <Row label="Total" value={money(preview.total)} strong />
        </dl>
        {previewError ? <p className="text-xs text-red-700">{previewError}</p> : null}
        {preview.warnings.length > 0 ? (
          <p className="text-xs text-amber-800">{preview.warnings.join(' ')}</p>
        ) : null}
        {preview.acceptingPayments || preview.total === 0 ? (
          <>
            <Submit pendingLabel="Placing order…">Continue to payment</Submit>
            <p className="text-center text-xs text-zinc-500">
              You’ll complete payment on a secure payment page.
            </p>
          </>
        ) : (
          <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            This store isn’t accepting payments yet. Please check back soon.
          </p>
        )}
      </aside>
    </form>
  );
}
