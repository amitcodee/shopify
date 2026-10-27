'use client';

import { type CheckoutPreview, formatMoney } from '@repo/contracts';
import { useActionState, useState, useTransition } from 'react';
import { FollowRedirect } from '@/components/follow-redirect';
import { Notice, Submit, TextField } from '@/components/form';
import { srcSetFor } from '@/lib/images';
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
    <div
      className={`flex items-baseline justify-between gap-4 ${
        strong ? 'pt-1 text-lg font-semibold text-zinc-900' : 'text-sm text-zinc-600'
      }`}
    >
      <dt>{label}</dt>
      <dd className={`tabular-nums ${strong ? '' : 'text-zinc-900'}`}>{value}</dd>
    </div>
  );
}

/** Step number before each checkout heading. */
function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white tabular-nums"
    >
      {n}
    </span>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0"
    >
      <path d="M6 11h12v10H6zM8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
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
  const [giftCardCode, setGiftCardCode] = useState('');
  /** The gift card code the current totals were computed with (sent with the order). */
  const [appliedGiftCard, setAppliedGiftCard] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const money = (n: number) => formatMoney(n, preview.currency);
  const err = state?.fieldErrors ?? {};

  function refresh(next: {
    country?: string;
    region?: string;
    shippingRateId?: string;
    discountCode?: string;
    giftCardCode?: string;
  }) {
    const input = {
      country,
      region,
      shippingRateId,
      discountCode,
      giftCardCode: appliedGiftCard,
      ...next,
    };
    startTransition(async () => {
      const result = await previewAction(input);
      if (result.preview) {
        setPreview(result.preview);
        setAppliedGiftCard(result.preview.giftCard ? input.giftCardCode : '');
        setShippingRateId(result.preview.selectedShippingRateId ?? '');
        setPreviewError(null);
      } else {
        setPreviewError(result.error ?? 'Could not update totals.');
      }
    });
  }

  return (
    <form
      action={formAction}
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14 xl:gap-20"
    >
      <FollowRedirect to={state?.redirectTo} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="shippingRateId" value={shippingRateId} />
      <input
        type="hidden"
        name="discountCode"
        value={preview.discount?.applied ? preview.discount.code : ''}
      />
      <input type="hidden" name="giftCardCode" value={appliedGiftCard} />

      <div className="space-y-10">
        <Notice result={state} />
        <section className="space-y-5" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="flex items-center gap-3 text-lg font-semibold">
            <Step n={1} />
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

        <section
          className="space-y-5 border-t border-zinc-200 pt-10"
          aria-labelledby="shipping-heading"
        >
          <h2 id="shipping-heading" className="flex items-center gap-3 text-lg font-semibold">
            <Step n={2} />
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
            <div>
              <label htmlFor="country" className="field-label">
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
                className="field"
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
          <div className="border-t border-zinc-200 pt-10">
            <fieldset className="space-y-2.5">
              <legend className="mb-5 flex items-center gap-3 text-lg font-semibold">
                <Step n={3} />
                Shipping method
              </legend>
              {preview.shippingOptions.length === 0 ? (
                <p className="text-sm text-red-700">We don’t ship to this country yet.</p>
              ) : (
                preview.shippingOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-[var(--field-radius)] border border-zinc-300 px-4 py-4 text-sm transition hover:border-zinc-500 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 has-[:checked]:ring-1 has-[:checked]:ring-zinc-900"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        className="size-4 accent-[var(--store-text)]"
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
                    <span className="font-medium tabular-nums">
                      {option.price === 0 ? 'Free' : money(option.price)}
                    </span>
                  </label>
                ))
              )}
            </fieldset>
          </div>
        ) : null}

        <div>
          <label htmlFor="note" className="field-label">
            Order note (optional)
          </label>
          <textarea id="note" name="note" rows={2} maxLength={500} className="field" />
        </div>
      </div>

      <aside
        aria-labelledby="summary-heading"
        className="panel h-fit space-y-6 p-5 sm:p-7 lg:sticky lg:top-28"
      >
        <h2 id="summary-heading" className="text-lg font-semibold">
          Order summary
        </h2>
        <ul className="space-y-4 text-sm">
          {preview.lines.map((line) => (
            <li key={line.id} className="flex items-center gap-4">
              <span className="relative size-16 shrink-0 rounded-[var(--radius-md)] border border-zinc-200 bg-zinc-100">
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.imageUrl}
                    srcSet={srcSetFor(line.imageUrl, line.imageRenditions)}
                    sizes="64px"
                    alt=""
                    className="h-full w-full rounded-[var(--radius-md)] object-cover"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-2 grid h-5 min-w-5 place-items-center rounded-full bg-zinc-700 px-1 text-[0.6875rem] font-semibold text-white tabular-nums"
                >
                  {line.quantity}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium break-words text-zinc-900">
                  {line.productTitle}
                </span>
                <span className="block text-xs text-zinc-500">
                  {line.variantTitle !== 'Default' ? `${line.variantTitle} · ` : ''}Qty{' '}
                  {line.quantity}
                </span>
                {line.properties?.length ? (
                  <span className="block text-xs text-zinc-500">
                    {line.properties.map((p) => `${p.label}: ${p.value}`).join(' · ')}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums">{money(line.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div>
          <label htmlFor="discount" className="field-label">
            Discount code
          </label>
          <div className="flex gap-2">
            <input
              id="discount"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              className="field min-w-0 flex-1 uppercase"
            />
            <button
              type="button"
              onClick={() => refresh({ discountCode })}
              className="btn btn-ghost px-4 text-sm"
              aria-label="Apply discount code"
            >
              Apply
            </button>
          </div>
          {preview.discount ? (
            <p
              className={`mt-2 text-xs ${preview.discount.applied ? 'text-emerald-700' : 'text-red-700'}`}
              role="status"
            >
              {preview.discount.applied
                ? `Code ${preview.discount.code} applied.`
                : preview.discount.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="gift-card" className="field-label">
            Gift card
          </label>
          <div className="flex gap-2">
            <input
              id="gift-card"
              value={giftCardCode}
              onChange={(e) => setGiftCardCode(e.target.value)}
              autoComplete="off"
              className="field min-w-0 flex-1 uppercase"
            />
            <button
              type="button"
              onClick={() => refresh({ giftCardCode })}
              className="btn btn-ghost px-4 text-sm"
              aria-label="Apply gift card"
            >
              Apply
            </button>
          </div>
          {preview.giftCard ? (
            <p className="mt-2 text-xs text-emerald-700" role="status">
              Gift card •••• {preview.giftCard.lastCharacters} applied
              {preview.giftCard.remaining > 0
                ? ` (${money(preview.giftCard.remaining)} left on the card after this order).`
                : '.'}
            </p>
          ) : preview.giftCardError ? (
            <p className="mt-2 text-xs text-red-700" role="status">
              {preview.giftCardError}
            </p>
          ) : null}
        </div>

        <dl
          className="space-y-2.5 border-t border-zinc-200 pt-5"
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
          {preview.giftCard ? (
            <>
              <Row label="Gift card" value={`−${money(preview.giftCard.applied)}`} />
              <Row label="Due now" value={money(preview.amountDue)} strong />
            </>
          ) : null}
        </dl>
        {previewError ? <p className="text-xs text-red-700">{previewError}</p> : null}
        {preview.warnings.length > 0 ? (
          <p className="text-xs text-amber-800">{preview.warnings.join(' ')}</p>
        ) : null}
        {preview.amountDue === 0 ? (
          <Submit pendingLabel="Placing order…">Place order</Submit>
        ) : preview.acceptingPayments ? (
          <>
            <Submit pendingLabel="Placing order…">Continue to payment</Submit>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
              <LockIcon />
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
