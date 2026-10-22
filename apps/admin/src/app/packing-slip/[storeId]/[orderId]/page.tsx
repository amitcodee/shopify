import type { OrderDetail } from '@repo/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDateTime } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Packing slip' };

const countryName = new Intl.DisplayNames(['en'], { type: 'region' });

/** A printable packing slip: what to put in the box and where it goes. No prices. */
export default async function PackingSlipPage({
  params,
}: {
  params: Promise<{ storeId: string; orderId: string }>;
}) {
  const { storeId, orderId } = await params;
  const store = await getStore(storeId);
  const order = await api<OrderDetail>(`/admin/stores/${storeId}/orders/${orderId}`).catch(
    (error: unknown) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
      throw error;
    },
  );
  const a = order.shippingAddress;
  const lines = order.lines.filter((l) => l.quantity > 0);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-8 py-10">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <Link
            href={`/s/${storeId}/orders/${orderId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Order #{order.number}
          </Link>
          <PrintButton />
        </div>

        <header className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold">{store.name}</h1>
            <p className="mt-1 text-sm text-slate-600">Packing slip</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Order #{order.number}</p>
            <p className="text-slate-600">{formatDateTime(order.createdAt)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 py-6 text-sm">
          <div>
            <h2 className="mb-2 font-semibold uppercase tracking-wide text-slate-500">Ship to</h2>
            <address className="not-italic leading-6">
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
              {countryName.of(a.country) ?? a.country}
              {a.phone ? (
                <>
                  <br />
                  {a.phone}
                </>
              ) : null}
            </address>
          </div>
          <div>
            <h2 className="mb-2 font-semibold uppercase tracking-wide text-slate-500">Shipping</h2>
            <p>{order.shippingMethod ?? 'Standard shipping'}</p>
            <p className="mt-1 text-slate-600">{order.email}</p>
          </div>
        </section>

        <table className="w-full border-t border-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-3 font-semibold">Item</th>
              <th className="py-3 font-semibold">SKU</th>
              <th className="py-3 text-right font-semibold">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 border-y border-slate-200">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-3">
                  {l.title}
                  {l.variantTitle !== 'Default' ? (
                    <span className="block text-slate-500">{l.variantTitle}</span>
                  ) : null}
                </td>
                <td className="py-3 text-slate-600">{l.sku ?? '—'}</td>
                <td className="py-3 text-right font-semibold">{l.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {order.note ? (
          <section className="mt-6 text-sm">
            <h2 className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Note</h2>
            <p className="whitespace-pre-line">{order.note}</p>
          </section>
        ) : null}

        <p className="mt-10 text-center text-sm text-slate-500">
          Thank you for shopping with {store.name}!
        </p>
      </div>
    </div>
  );
}
