import { randomUUID } from 'node:crypto';
import type { CheckoutPreview, CustomerAccount } from '@repo/contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckoutSteps } from '@/components/checkout-steps';
import { sf, StorefrontApiError } from '@/lib/api';
import { getCart, getCartToken, getCustomerToken, getShop } from '@/lib/shop';
import { CheckoutForm } from './checkout-form';

export const metadata = { title: 'Checkout' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string; declined?: string }>;
}) {
  const { cancelled, declined } = await searchParams;
  const [cart, shop] = await Promise.all([getCart(), getShop()]);
  if (!cart || cart.lines.length === 0) redirect('/cart');

  const preview = await sf<CheckoutPreview>('/checkout/preview', {
    method: 'POST',
    cartToken: await getCartToken(),
    body: { country: 'US' },
  });

  let email: string | null = null;
  const customerToken = await getCustomerToken();
  if (customerToken) {
    try {
      email = (await sf<CustomerAccount>('/customers/me', { customerToken })).email;
    } catch (error) {
      if (!(error instanceof StorefrontApiError)) throw error;
    }
  }

  return (
    <>
      <CheckoutSteps current="details" />
      <div className="mb-10 border-b border-zinc-200 pb-6">
        <p className="eyebrow text-zinc-500">Secure checkout</p>
        <h1 className="page-title t-title mt-2">Checkout</h1>
      </div>
      {cancelled || declined ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {declined
            ? 'Your payment was declined. Please try again.'
            : 'Payment was cancelled. Your cart is still here.'}
        </p>
      ) : null}
      <CheckoutForm initial={preview} idempotencyKey={randomUUID()} email={email} />
      {shop && shop.policies.length > 0 ? (
        <nav
          aria-label="Store policies"
          className="mt-8 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-200 pt-4 text-xs text-zinc-500"
        >
          {shop.policies.map((p) => (
            <Link
              key={p.kind}
              href={`/policies/${p.kind}`}
              className="underline hover:text-zinc-900"
            >
              {p.title}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
