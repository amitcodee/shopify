import type { GstDocuments } from '@repo/contracts';
import { CreditNoteDocument, TaxInvoiceDocument } from '@repo/invoice-view';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { PrintButton } from '../../[orderId]/print-button';

export const metadata: Metadata = { title: 'Tax invoices' };

const sheet =
  '[&:not(:first-child)]:break-before-page rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200 print:rounded-none print:p-0 print:shadow-none print:ring-0 [&:not(:first-child)]:mt-6 print:[&:not(:first-child)]:mt-0';

/** Every invoice and credit note issued in a month, one per printed page, to keep as records. */
export default async function MonthInvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; month: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { storeId, month } = await params;
  const { page } = await searchParams;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();
  const docs = await api<GstDocuments>(`/admin/stores/${storeId}/gst-returns/documents`, {
    query: { month, page: Number(page) || 1 },
  }).catch((error: unknown) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  });
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const base = `/tax-invoice/${storeId}/month/${month}`;
  const count = docs.invoices.length + docs.creditNotes.length;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="mx-auto max-w-[230mm] px-4 py-8 print:p-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <Link
              href={`/s/${storeId}/orders/gst?month=${month}`}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              ← Back to GST returns
            </Link>
            <h1 className="mt-2 text-lg font-semibold text-slate-900">
              Tax invoices and credit notes · {label}
            </h1>
            <p className="text-sm text-slate-500">
              {docs.invoiceCount} invoice{docs.invoiceCount === 1 ? '' : 's'},{' '}
              {docs.creditNoteCount} credit note{docs.creditNoteCount === 1 ? '' : 's'}
              {docs.pageCount > 1 ? ` · part ${docs.page} of ${docs.pageCount}` : ''}
            </p>
          </div>
          {count > 0 ? (
            <div className="flex items-center gap-3">
              <p className="hidden max-w-56 text-xs text-slate-500 sm:block">
                Choose “Save as PDF” in the print window to keep a copy for your records.
              </p>
              <PrintButton />
            </div>
          ) : null}
        </div>

        {count === 0 ? (
          <div className="mx-auto max-w-lg rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">
              No invoices or credit notes were issued in {label}.
            </p>
          </div>
        ) : (
          <div>
            {docs.invoices.map((invoice) => (
              <div key={invoice.id} className={sheet}>
                <TaxInvoiceDocument invoice={invoice} />
              </div>
            ))}
            {docs.creditNotes.map((note) => (
              <div key={note.id} className={sheet}>
                <CreditNoteDocument note={note} />
              </div>
            ))}
          </div>
        )}

        {docs.pageCount > 1 ? (
          <nav
            aria-label="Parts"
            className="mt-6 flex items-center justify-between text-sm print:hidden"
          >
            {docs.page > 1 ? (
              <Link
                href={`${base}?page=${docs.page - 1}`}
                className="text-indigo-600 hover:underline"
              >
                ← Part {docs.page - 1}
              </Link>
            ) : (
              <span />
            )}
            {docs.page < docs.pageCount ? (
              <Link
                href={`${base}?page=${docs.page + 1}`}
                className="text-indigo-600 hover:underline"
              >
                Part {docs.page + 1} →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
