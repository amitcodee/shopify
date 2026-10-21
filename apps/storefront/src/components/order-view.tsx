import { formatMoney, type PublicOrder } from '@repo/contracts';

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
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <section aria-labelledby="status-heading" className="rounded-xl border border-zinc-200 p-6">
          <h2 id="status-heading" className="text-sm font-medium text-zinc-500">
            Status
          </h2>
          <p className="mt-1 text-xl font-semibold">{statusLabel(order)}</p>
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
        </section>
        <section aria-labelledby="ship-heading">
          <h2 id="ship-heading" className="mb-2 text-lg font-semibold">
            Shipping to
          </h2>
          <address className="text-sm not-italic text-zinc-700">
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
            {a.country}
          </address>
          {order.shippingMethod ? (
            <p className="mt-2 text-sm text-zinc-500">{order.shippingMethod}</p>
          ) : null}
        </section>
      </div>
      <aside aria-labelledby="items-heading" className="h-fit rounded-xl bg-zinc-50 p-6">
        <h2 id="items-heading" className="text-lg font-semibold">
          Items
        </h2>
        <ul className="mt-4 space-y-3 text-sm">
          {order.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>
                {l.title}
                {l.variantTitle !== 'Default' ? ` · ${l.variantTitle}` : ''} × {l.quantity}
              </span>
              <span>{money(l.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-zinc-200 pt-4 text-sm">
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
          <div className="flex justify-between text-base font-semibold">
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
