import type { PublicOrder } from '@repo/contracts';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { OrderView } from '@/components/order-view';
import { sf, StorefrontApiError } from '@/lib/api';
import { getCustomerToken } from '@/lib/shop';
import { Returns } from './returns';

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const customerToken = await getCustomerToken();
  if (!customerToken) redirect('/account/login');
  if (!/^\d{1,9}$/.test(number)) notFound();
  let order: PublicOrder;
  try {
    order = await sf<PublicOrder>(`/customers/me/orders/${number}`, { customerToken });
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 401) redirect('/account/login');
    if (error instanceof StorefrontApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <Link href="/account" className="text-sm text-zinc-500 hover:underline">
        ← Your account
      </Link>
      <h1 className="page-title t-title mt-2 mb-8">Order #{order.number}</h1>
      <OrderView order={order} />
      <Returns order={order} />
    </>
  );
}
