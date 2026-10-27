import { formatMoney, type PublicOrder } from '@repo/contracts';

const countryName = new Intl.DisplayNames(['en'], { type: 'region' });

function statusLabel(order: PublicOrder): string {
  if (order.status === 'CANCELLED') return 'Cancelled';
  if (order.financialStatus === 'REFUNDED') return 'Refunded';
  if (order.status === 'PENDING_PAYMENT') return 'Awaiting payment';
  return order.fulfillmentStatus === 'FULFILLED' ? 'Shipped' : 'Confirmed — preparing your order';
}

export function OrderView({ order }: { order: PublicOrder }) {
  const money = (n: number) => formatMoney(n, order.currency);
  const a = order.shippingAddress;
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-14">
      <div className="space-y-8">
        <section
          aria-labelledby="status-heading"
          className="flex gap-4 rounded-xl border border-zinc-200 p-6 sm:p-7"
        >
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <path d="M21 8 12 3 3 8m18 0v8l-9 5m9-13-9 5m0 8-9-5V8m9 13v-8M3 8l9 5" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="status-heading" className="eyebrow text-zinc-500">
              Status
            </h2>
            <p className="mt-1.5 text-xl font-semibold">{statusLabel(order)}</p>
            {order.fulfillments.map((f) => (
              <p key={f.createdAt} className="mt-3 text-sm text-zinc-700">
                Shipped {f.trackingCompany ? `with ${f.trackingCompany}` : ''}
                {f.trackingNumber ? ` · tracking ${f.trackingNumber}` : ''}
                {f.trackingUrl ? (
                  <>
                    {' · '}
                    <a
                      href={f.trackingUrl}
                      className="underline"
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Track package
                    </a>
                  </>
                ) : null}
              </p>
            ))}
          </div>
        </section>
        <section aria-labelledby="ship-heading" className="border-t border-zinc-200 pt-8">
          <h2 id="ship-heading" className="eyebrow mb-3 text-zinc-500">
            Shipping to
          </h2>
          <address className="leading-relaxed not-italic text-zinc-800">
            {a.name}
            <br />
            {a.line1}
            {a.line2 ? (
              <>
                <br />
                {a.line2}
              </>
            ) : null}
            <br />
            {a.city}
            {a.region ? `, ${a.region}` : ''} {a.postalCode}
            <br />
            {countryName.of(a.country) ?? a.country}
          </address>
          {order.shippingMethod ? (
            <p className="mt-2 text-sm text-zinc-500">{order.shippingMethod}</p>
          ) : null}
        </section>
      </div>
      <aside aria-labelledby="items-heading" className="panel h-fit p-6 sm:p-7">
        <h2 id="items-heading" className="text-lg font-semibold">
          Items
        </h2>
        <ul className="mt-5 space-y-3 text-sm">
          {order.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>
                {l.title}
                {l.variantTitle !== 'Default' ? ` · ${l.variantTitle}` : ''} × {l.quantity}
                {l.properties?.length ? (
                  <span className="block text-sm text-zinc-500">
                    {l.properties.map((p) => `${p.label}: ${p.value}`).join(' · ')}
                  </span>
                ) : null}
              </span>
              <span>{money(l.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2 border-t border-zinc-200 pt-5 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 ? (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>−{money(order.discountTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{money(order.shippingTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>{money(order.taxTotal)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-lg font-semibold">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
          {order.giftCardAmount > 0 ? (
            <div className="flex justify-between">
              <dt>Paid with gift card</dt>
              <dd>−{money(order.giftCardAmount)}</dd>
            </div>
          ) : null}
        </dl>
      </aside>
    </div>
  );
}
