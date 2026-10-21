import { formatMoney, type StorefrontInvoice } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { isNotFound, sf } from '@/lib/api';
import { PayInvoiceButton } from './pay-button';

export const metadata = { title: 'Invoice', robots: { index: false } };

async function getInvoice(token: string): Promise<StorefrontInvoice | null> {
  try {
    return await sf<StorefrontInvoice>(`/invoices/${encodeURIComponent(token)}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const [{ token }, { cancelled }] = await Promise.all([params, searchParams]);
  const invoice = await getInvoice(token.slice(0, 200));
  if (!invoice) notFound();
  const money = (amount: number) => formatMoney(amount, invoice.currency);
  const totals: [string, number][] = [
    ['Subtotal', invoice.subtotal],
    ...(invoice.discountTotal
      ? ([['Discount', -invoice.discountTotal]] as [string, number][])
      : []),
    ['Shipping', invoice.shippingTotal],
    ['Tax', invoice.taxTotal],
  ];

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">Invoice #D{invoice.number}</h1>
      <p className="mt-1 text-zinc-600">From {invoice.storeName}</p>

      {cancelled && invoice.state === 'payable' ? (
        <p
          role="status"
          className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Payment was cancelled. You can try again below.
        </p>
      ) : null}

      <ul className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
        {invoice.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-4 py-3 text-sm">
            <span>
              {l.title}
              {l.variantTitle !== 'Default' ? (
                <span className="text-zinc-500"> · {l.variantTitle}</span>
              ) : null}{' '}
              × {l.quantity}
            </span>
            <span>{money(l.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1 text-sm">
        {totals.map(([label, amount]) => (
          <div key={label} className="flex justify-between text-zinc-600">
            <dt>{label}</dt>
            <dd>{money(amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd>{money(invoice.total)}</dd>
        </div>
      </dl>

      <div className="mt-8">
        {invoice.state === 'payable' ? (
          <PayInvoiceButton token={token} label={`Pay ${money(invoice.total)}`} />
        ) : invoice.state === 'paid' ? (
          <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
            This invoice has been paid. Thank you!
          </p>
        ) : (
          <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">
            This invoice is no longer available. Contact the store for help.
          </p>
        )}
      </div>
    </div>
  );
}
