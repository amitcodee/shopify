import { randomUUID } from 'node:crypto';
import type { CheckoutPreview, CustomerAccount } from '@repo/contracts';
import { redirect } from 'next/navigation';
import { sf, StorefrontApiError } from '@/lib/api';
import { getCart, getCartToken, getCustomerToken } from '@/lib/shop';
import { CheckoutForm } from './checkout-form';

export const metadata = { title: 'Checkout' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string; declined?: string }>;
}) {
  const { cancelled, declined } = await searchParams;
  const cart = await getCart();
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
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Checkout</h1>
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
    </>
  );
}
