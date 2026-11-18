import type { OrderInvoice } from '@repo/contracts';
import { TaxInvoiceDocument } from '@repo/invoice-view';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isNotFound, sf } from '@/lib/api';
import { PrintButton } from './print-button';

export const metadata = { title: 'Tax invoice', robots: { index: false } };

/** The shopper's copy of the GST invoice; printing shows only the invoice. */
export default async function OrderInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invoice: OrderInvoice;
  try {
    invoice = await sf<OrderInvoice>(`/orders/${encodeURIComponent(token)}/invoice`);
  } catch (error) {
    if (isNotFound(error)) notFound();
    throw error;
  }

  return (
    <>
      <style>{`@media print {
  body * { visibility: hidden; }
  #tax-invoice, #tax-invoice * { visibility: visible; }
  #tax-invoice { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0; box-shadow: none; border: 0; }
}`}</style>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/orders/${encodeURIComponent(token)}`}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Order #{invoice.data.orderNumber}
        </Link>
        <PrintButton />
      </div>
      <div
        id="tax-invoice"
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 sm:p-8"
      >
        <TaxInvoiceDocument invoice={invoice} />
      </div>
    </>
  );
}
