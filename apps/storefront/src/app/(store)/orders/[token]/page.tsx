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

  const awaitingCodConfirmation = order.cashOnDelivery && order.status === 'PENDING_PAYMENT';
  const confirmed =
    from === 'checkout' &&
    (order.financialStatus === 'PAID' || (order.cashOnDelivery && order.status === 'OPEN'));

  return (
    <>
      <p className="eyebrow text-zinc-500">Order #{order.number}</p>
      <h1 className="page-title t-title mt-2 mb-8">
        {confirmed ? 'Thank you for your order!' : 'Your order'}
      </h1>
      {confirmed ? (
        <p className="-mt-4 mb-8 text-zinc-600">
          A confirmation email is on its way. Bookmark this page to track your order.
        </p>
      ) : null}
      {awaitingCodConfirmation ? (
        <div
          role="status"
          className="-mt-2 mb-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900"
        >
          <p className="font-semibold">One more step: confirm your order from your email</p>
          <p className="mt-1 text-sm">
            We sent a link to your email address. Open it to confirm this cash on delivery order.
            Orders that are not confirmed within 12 hours are cancelled automatically.
          </p>
        </div>
      ) : null}
      <OrderView order={order} />
    </>
  );
}
