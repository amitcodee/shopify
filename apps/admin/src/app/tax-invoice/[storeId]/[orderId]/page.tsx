import type { OrderInvoiceState } from '@repo/contracts';
import { TaxInvoiceDocument } from '@repo/invoice-view';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { issueInvoiceAction } from './actions';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Tax invoice' };

/** The order's GST tax invoice, ready to print or save as PDF; issues it if it has none yet. */
export default async function TaxInvoicePage({
  params,
}: {
  params: Promise<{ storeId: string; orderId: string }>;
}) {
  const { storeId, orderId } = await params;
  const store = await getStore(storeId);
  const state = await api<OrderInvoiceState>(
    `/admin/stores/${storeId}/orders/${orderId}/invoice`,
  ).catch((error: unknown) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  });
  const canWrite = store.permissions.includes('orders:write');

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="mx-auto max-w-[230mm] px-4 py-8 print:p-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={`/s/${storeId}/orders/${orderId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to the order
          </Link>
          {state.invoice ? (
            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-slate-500 sm:block">
                Choose “Save as PDF” in the print window for a PDF copy.
              </p>
              <PrintButton />
            </div>
          ) : null}
        </div>

        {state.invoice ? (
          <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200 print:rounded-none print:p-0 print:shadow-none print:ring-0">
            <TaxInvoiceDocument invoice={state.invoice} />
          </div>
        ) : (
          <div className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <h1 className="text-lg font-semibold text-slate-900">No tax invoice yet</h1>
            <p className="mt-2 text-sm text-slate-600">
              {state.canIssue
                ? 'Invoices are issued when an order is paid or shipped. This order was placed before that, or before you added your GSTIN. Issue it now: it takes the next number in this financial year and cannot be changed afterwards.'
                : state.reason}
            </p>
            {state.canIssue && canWrite ? (
              <form action={issueInvoiceAction.bind(null, storeId, orderId)} className="mt-5">
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Issue tax invoice
                </button>
              </form>
            ) : null}
            {!state.canIssue ? (
              <Link
                href={`/s/${storeId}/settings/taxes`}
                className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:underline"
              >
                Open tax settings
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
