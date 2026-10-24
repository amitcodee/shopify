import type { PublicOrder } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { OrderView } from '@/components/order-view';
import { isNotFound, sf } from '@/lib/api';

export const metadata = { title: 'Order status', robots: { index: false } };

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { token } = await params;
  const { from } = await searchParams;
  let order: PublicOrder;
  try {
    order = await sf<PublicOrder>(`/orders/${encodeURIComponent(token)}`);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }

  return (
    <>
      <p className="eyebrow text-zinc-500">Order #{order.number}</p>
      <h1 className="page-title t-title mt-2 mb-8">
        {from === 'checkout' && order.financialStatus === 'PAID'
          ? 'Thank you for your order!'
          : 'Your order'}
      </h1>
      {from === 'checkout' && order.financialStatus === 'PAID' ? (
        <p className="-mt-4 mb-8 text-zinc-600">
          A confirmation email is on its way. Bookmark this page to track your order.
        </p>
      ) : null}
      <OrderView order={order} />
    </>
  );
}
