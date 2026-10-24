import { formatMoney } from '@repo/contracts';
import Link from 'next/link';
import { CartLineControls } from '@/components/cart/line-controls';
import { lineProblem } from '@/components/cart/line-status';
import { ArrowRightIcon, BagIcon } from '@/components/header/icons';
import { srcSetFor } from '@/lib/images';
import { getCart, getShop } from '@/lib/shop';

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
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center sm:py-24">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
          <BagIcon width="34" height="34" />
        </span>
        <h1 className="page-title t-title mt-6">Your cart is empty</h1>
        {recovery === 'expired' ? (
          <p role="status" className="mt-3 text-zinc-600">
            That link has expired, but the store is still open.
          </p>
        ) : (
          <p className="mt-3 text-zinc-600">
            Have a look around — there is plenty waiting to be discovered.
          </p>
        )}
        <Link href="/collections/all" className="btn mt-8 px-7 py-3 text-sm">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 sm:mb-10">
        <div>
          <h1 className="page-title t-title">Your cart</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <Link
          href="/collections/all"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 underline-offset-4 hover:text-zinc-950 hover:underline"
        >
          Continue shopping
          <ArrowRightIcon />
        </Link>
      </div>
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
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <section aria-label="Items in your cart">
          <div className="hidden grid-cols-[minmax(0,1fr)_auto] border-b border-zinc-200 pb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase sm:grid">
            <span>Product</span>
            <span>Total</span>
          </div>
          <ul className="divide-y divide-zinc-200 border-b border-zinc-200 max-sm:border-t">
            {cart.lines.map((line, index) => {
              const problem = lineProblem(line);
              const href = problem?.linkable === false ? null : `/products/${line.productHandle}`;
              const thumbClass = `h-28 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-100 sm:h-36 sm:w-28 ${
                problem ? 'opacity-50 grayscale' : ''
              }`;
              const thumb = line.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.imageUrl}
                  srcSet={srcSetFor(line.imageUrl, line.imageRenditions)}
                  sizes="(min-width: 640px) 112px, 96px"
                  alt=""
                  loading={index < 4 ? undefined : 'lazy'}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : null;
              return (
                <li key={line.id} className="flex gap-4 py-6 sm:gap-6">
                  {href ? (
                    <Link href={href} tabIndex={-1} aria-hidden="true" className={thumbClass}>
                      {thumb}
                    </Link>
                  ) : (
                    <span aria-hidden="true" className={thumbClass}>
                      {thumb}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className="flex justify-between gap-4">
                      <div className="min-w-0">
                        {href ? (
                          <Link href={href} className="card-title hover:underline">
                            {line.productTitle}
                          </Link>
                        ) : (
                          <span className="card-title text-zinc-500">{line.productTitle}</span>
                        )}
                        {line.variantTitle !== 'Default' ? (
                          <p className="mt-1 text-sm text-zinc-500">{line.variantTitle}</p>
                        ) : null}
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatMoney(line.unitPrice, cart.currency)} each
                        </p>
                        {problem ? (
                          <p className="mt-1 text-sm font-medium text-red-700">{problem.label}</p>
                        ) : null}
                      </div>
                      <p
                        className={`font-medium whitespace-nowrap tabular-nums ${
                          problem ? 'text-zinc-400 line-through' : ''
                        }`}
                      >
                        {problem ? <span className="sr-only">Not included: </span> : null}
                        {formatMoney(line.lineTotal, cart.currency)}
                      </p>
                    </div>
                    <div className="mt-auto">
                      <CartLineControls key={`${line.id}-${line.quantity}`} line={line} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <aside aria-labelledby="summary-heading" className="panel p-6 sm:p-7 lg:sticky lg:top-28">
          <h2 id="summary-heading" className="text-lg font-semibold">
            Order summary
          </h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-600">Subtotal</dt>
              <dd className="font-medium tabular-nums">
                {formatMoney(cart.subtotal, cart.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-600">Shipping</dt>
              <dd className="text-zinc-500">At checkout</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-4 text-base font-semibold">
              <dt>Estimated total</dt>
              <dd className="tabular-nums">{formatMoney(cart.subtotal, cart.currency)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-zinc-500">
            Shipping and taxes are calculated at checkout.
          </p>
          <Link
            href="/checkout"
            aria-disabled={cart.subtotal === 0}
            className="btn btn-strong mt-6 flex min-h-[3.25rem] w-full px-4 py-3.5 text-sm"
          >
            Check out
          </Link>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Secure checkout
          </p>
        </aside>
      </div>
    </>
  );
}
