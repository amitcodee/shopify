'use client';

import { type Cart, formatMoney, type StoreApps } from '@repo/contracts';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { BagIcon, CloseIcon } from '@/components/header/icons';
import { useDrawer } from '@/components/header/use-drawer';
import { srcSetFor } from '@/lib/images';
import { FreeShippingBar } from '@/components/apps/free-shipping-bar';
import { CART_ADDED_EVENT, CART_OPEN_EVENT } from './cart-events';
import { CartLineControls } from './line-controls';
import { lineProblem } from './line-status';
import { LineProperties } from './line-properties';

/**
 * Slide-out cart from the right. It opens after an add to cart (`cart:added`) and when the
 * header cart link is clicked (`cart:open`); the cart itself comes from the layout, which the
 * cart server actions revalidate. Closed, nothing is rendered.
 */
export function CartDrawer({
  cart,
  freeShipping,
  baseCurrency,
}: {
  cart: Cart | null;
  freeShipping: StoreApps['freeShippingBar'];
  baseCurrency: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const { state, open, close } = useDrawer(panel);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onAdded() {
      router.refresh();
      open();
    }
    window.addEventListener(CART_ADDED_EVENT, onAdded);
    window.addEventListener(CART_OPEN_EVENT, open);
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, onAdded);
      window.removeEventListener(CART_OPEN_EVENT, open);
    };
  }, [open, router]);

  // Following a link out of the drawer (a product, "View cart") closes it.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    close();
  }, [pathname, close]);

  if (state === 'closed') return null;
  const lines = cart?.lines ?? [];
  const count = cart?.itemCount ?? 0;
  const currency = cart?.currency ?? '';
  const subtotal = cart?.subtotal ?? 0;

  return (
    <div className="drawer-root fixed inset-0 z-50" data-state={state}>
      <div className="drawer-overlay absolute inset-0" aria-hidden="true" onClick={close} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
        className="drawer-panel drawer-right absolute inset-y-0 right-0 flex w-full max-w-[26rem] flex-col bg-page text-ink shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <h2 id="cart-drawer-title" className="t-title text-xl">
            Your cart
            {count > 0 ? (
              <span className="ml-2 align-middle text-sm font-normal tracking-normal text-zinc-500 normal-case">
                {count} {count === 1 ? 'item' : 'items'}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={close}
            data-autofocus
            className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <CloseIcon />
            <span className="sr-only">Close cart</span>
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <BagIcon width="28" height="28" />
            </span>
            <h3 className="t-title mt-5 text-2xl">Your cart is empty</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Find something you love — it will be waiting here.
            </p>
            <Link href="/collections/all" onClick={close} className="btn mt-6 px-6 py-3 text-sm">
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
              {cart && cart.warnings.length > 0 ? (
                <ul
                  role="alert"
                  className="mt-4 list-disc rounded-md border border-amber-200 bg-amber-50 py-3 pr-3 pl-7 text-sm text-amber-900"
                >
                  {cart.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <ul className="divide-y divide-zinc-200">
                {lines.map((line, index) => {
                  const problem = lineProblem(line);
                  const href =
                    problem?.linkable === false ? null : `/products/${line.productHandle}`;
                  const thumbClass = `cart-thumb h-24 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-100 ${
                    problem ? 'opacity-50 grayscale' : ''
                  }`;
                  const thumb = line.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={line.imageUrl}
                      srcSet={srcSetFor(line.imageUrl, line.imageRenditions)}
                      sizes="80px"
                      alt=""
                      loading={index < 4 ? undefined : 'lazy'}
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : null;
                  return (
                    <li key={line.id} className="flex gap-4 py-5">
                      {href ? (
                        <Link href={href} tabIndex={-1} aria-hidden="true" className={thumbClass}>
                          {thumb}
                        </Link>
                      ) : (
                        <span aria-hidden="true" className={thumbClass}>
                          {thumb}
                        </span>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            {href ? (
                              <Link href={href} className="card-title leading-snug hover:underline">
                                {line.productTitle}
                              </Link>
                            ) : (
                              <span className="card-title leading-snug text-zinc-500">
                                {line.productTitle}
                              </span>
                            )}
                            {line.variantTitle !== 'Default' ? (
                              <p className="mt-0.5 text-xs text-zinc-500">{line.variantTitle}</p>
                            ) : null}
                            <LineProperties
                              properties={line.properties}
                              currency={currency}
                              className="mt-0.5 space-y-0.5 text-xs text-zinc-500"
                            />
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {formatMoney(line.unitPrice, currency)}
                            </p>
                            {problem ? (
                              <p className="mt-1 text-xs font-medium text-red-700">
                                {problem.label}
                              </p>
                            ) : null}
                          </div>
                          <p
                            className={`text-sm font-medium whitespace-nowrap tabular-nums ${
                              problem ? 'text-zinc-400 line-through' : ''
                            }`}
                          >
                            {problem ? <span className="sr-only">Not included: </span> : null}
                            {formatMoney(line.lineTotal, currency)}
                          </p>
                        </div>
                        <CartLineControls key={`${line.id}-${line.quantity}`} line={line} compact />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="border-t border-zinc-200 bg-surface/40 px-5 pt-5 pb-6 sm:px-6">
              <div className="mb-4 empty:hidden">
                <FreeShippingBar
                  app={freeShipping}
                  subtotal={subtotal}
                  currency={currency}
                  baseCurrency={baseCurrency}
                />
              </div>
              <dl className="flex items-baseline justify-between text-base font-semibold">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
              </dl>
              <p className="mt-1 text-xs text-zinc-500">
                Shipping and taxes are calculated at checkout.
              </p>
              <Link
                href="/checkout"
                aria-disabled={subtotal === 0}
                className="btn btn-strong mt-5 flex min-h-[3.25rem] w-full px-4 py-3.5 text-sm"
              >
                Check out
              </Link>
              <Link
                href="/cart"
                className="btn btn-ghost mt-3 flex min-h-12 w-full px-4 py-3 text-sm"
              >
                View cart
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
