import { formatMoney, type MockPayment } from '@repo/contracts';
import { notFound, redirect } from 'next/navigation';
import { isNotFound, sameHostPath, sf } from '@/lib/api';
import { PayButtons } from './pay-buttons';

export const metadata = { title: 'Sandbox payment' };

/** Stand-in for a provider-hosted payment page. Only exists with the mock (sandbox) provider. */
export default async function SandboxPaymentPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  let payment: MockPayment;
  try {
    payment = await sf<MockPayment>(`/checkout/mock-payments/${encodeURIComponent(reference)}`);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }
  if (payment.status === 'SUCCEEDED' && payment.returnUrl)
    redirect(await sameHostPath(payment.returnUrl));

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">
          Sandbox payment · no real money
        </p>
        <h1 className="mt-2 text-2xl font-bold">Pay {payment.storeName}</h1>
        <p className="mt-1 text-sm text-zinc-600">Order #{payment.orderNumber}</p>
        <p className="mt-6 text-4xl font-bold">{formatMoney(payment.amount, payment.currency)}</p>
        {payment.status === 'PENDING' ? (
          <PayButtons reference={reference} />
        ) : (
          <p className="mt-8 text-sm text-zinc-700">
            This payment is {payment.status.toLowerCase()}.
          </p>
        )}
      </div>
    </div>
  );
}
