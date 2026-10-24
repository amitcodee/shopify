import { formatMoney } from '@repo/contracts';
import Link from 'next/link';
import { getCart, getShop } from '@/lib/shop';
import { removeLineAction, updateLineAction } from './actions';

export const metadata = { title: 'Cart' };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string }>;
}) {
  const [shop, cart, { recovery }] = await Promise.all([getShop(), getCart(), searchParams]);
  if (!shop) return null;

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Your cart is empty</h1>
        {recovery === 'expired' ? (
          <p role="status" className="mt-2 text-zinc-600">
            That link has expired, but the store is still open.
          </p>
        ) : null}
        <Link href="/collections/all" className="mt-6 inline-block text-sm font-medium underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Your cart</h1>
      {cart.warnings.length > 0 ? (
        <div
          role="alert"
          className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <ul className="list-disc pl-5">
            {cart.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex gap-4 py-6">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div>
                    <Link
                      href={`/products/${line.productHandle}`}
                      className="font-medium hover:underline"
                    >
                      {line.productTitle}
                    </Link>
                    {line.variantTitle !== 'Default' ? (
                      <p className="text-sm text-zinc-500">{line.variantTitle}</p>
                    ) : null}
                    <p className="text-sm text-zinc-500">
                      {formatMoney(line.unitPrice, cart.currency)} each
                    </p>
                  </div>
                  <p className="font-medium">{formatMoney(line.lineTotal, cart.currency)}</p>
                </div>
                <div className="mt-auto flex items-center gap-4 pt-3">
                  <form
                    action={updateLineAction.bind(null, line.id)}
                    className="flex items-center gap-2"
                  >
                    <label htmlFor={`qty-${line.id}`} className="text-sm text-zinc-600">
                      Qty
                    </label>
                    <input
                      id={`qty-${line.id}`}
                      name="quantity"
                      type="number"
                      min={0}
                      max={line.maxQuantity ?? 99}
                      defaultValue={line.quantity}
                      className="field w-16! px-2! py-1.5!"
                    />
                    <button type="submit" className="text-sm font-medium underline">
                      Update
                    </button>
                  </form>
                  <form action={removeLineAction.bind(null, line.id)}>
                    <button
                      type="submit"
                      className="text-sm text-zinc-500 underline hover:text-zinc-900"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside aria-labelledby="summary-heading" className="h-fit rounded-xl bg-zinc-50 p-6">
          <h2 id="summary-heading" className="text-lg font-semibold">
            Order summary
          </h2>
          <dl className="mt-4 flex justify-between text-sm">
            <dt>Subtotal</dt>
            <dd className="font-semibold">{formatMoney(cart.subtotal, cart.currency)}</dd>
          </dl>
          <p className="mt-2 text-xs text-zinc-500">
            Shipping and taxes are calculated at checkout.
          </p>
          <Link
            href="/checkout"
            aria-disabled={cart.subtotal === 0}
            className="mt-6 block rounded-full bg-brand shadow-sm px-4 py-3 text-center text-sm font-semibold text-brand-contrast hover:opacity-90"
          >
            Check out
          </Link>
        </aside>
      </div>
    </>
  );
}
