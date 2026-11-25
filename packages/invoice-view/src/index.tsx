import type { CreditNote, OrderInvoice, TaxInvoiceData } from '@repo/contracts';
import type { ReactNode } from 'react';

/**
 * A GST tax invoice laid out for A4: seller and buyer, place of supply, one row per item with
 * HSN, taxable value and the CGST + SGST (or IGST) split, the HSN summary, and the total in
 * words. Plain colours so it prints well; the page around it adds the print button.
 */
export function TaxInvoiceDocument({ invoice }: { invoice: OrderInvoice }) {
  const d = invoice.data;
  const amount = amountFormatter(d.currency);
  const money = (n: number) => amount.format(n / 100);
  const intra = d.supplyType === 'intra';
  const pct = (bps: number) => `${trimZeros(bps / 100)}%`;
  const date = (iso: string) =>
    new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );
  const taxCells = (row: { cgst: number; sgst: number; igst: number }) =>
    intra ? (
      <>
        <Num>{money(row.cgst)}</Num>
        <Num>{money(row.sgst)}</Num>
      </>
    ) : (
      <Num>{money(row.igst)}</Num>
    );

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white text-[13px] leading-5 text-neutral-900 print:max-w-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-neutral-900 pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Tax invoice
          </p>
          <h1 className="mt-1 text-xl font-bold">{d.seller.legalName}</h1>
          {d.seller.storeName !== d.seller.legalName ? (
            <p className="text-neutral-600">Trading as {d.seller.storeName}</p>
          ) : null}
          <p className="mt-2 max-w-sm whitespace-pre-line text-neutral-700">{d.seller.address}</p>
          <p className="mt-2">
            <span className="text-neutral-500">GSTIN </span>
            <span className="font-mono font-semibold">{d.seller.gstin}</span>
          </p>
          <p className="text-neutral-600">
            State: {d.seller.stateName} ({d.seller.stateCode}) · {d.seller.email}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right sm:text-left">
          <Meta label="Invoice no.">
            <span className="font-mono font-semibold">{invoice.number}</span>
          </Meta>
          <Meta label="Invoice date">{date(invoice.issuedAt)}</Meta>
          <Meta label="Order">
            #{d.orderNumber} · {date(d.orderDate)}
          </Meta>
          <Meta label="Place of supply">
            {d.placeOfSupply.name}
            {d.placeOfSupply.code ? ` (${d.placeOfSupply.code})` : ''}
          </Meta>
          <Meta label="Reverse charge">No</Meta>
        </dl>
      </header>

      <section className="grid gap-6 border-b border-neutral-200 py-5 sm:grid-cols-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Billed and shipped to
          </h2>
          <p className="mt-1 font-semibold">{d.buyer.name}</p>
          {d.buyer.address.map((line, i) => (
            <p key={i} className="text-neutral-700">
              {line}
            </p>
          ))}
          {d.buyer.gstin ? (
            <p className="mt-1">
              <span className="text-neutral-500">GSTIN </span>
              <span className="font-mono font-semibold">{d.buyer.gstin}</span>
            </p>
          ) : null}
          <p className="text-neutral-600">
            {[d.buyer.phone, d.buyer.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="sm:text-right">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Payment
          </h2>
          <p className="mt-1">{d.paymentMethod}</p>
          <p className="text-neutral-600">{d.paid ? 'Paid' : 'To be collected'}</p>
          {d.supplyType === 'export' ? (
            <p className="mt-2 text-neutral-600">Supply outside India.</p>
          ) : null}
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="mt-4 w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-y border-neutral-300 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-600">
              <Th>#</Th>
              <Th>Item</Th>
              <Th>HSN</Th>
              <Th right>Qty</Th>
              <Th right>Rate</Th>
              <Th right>Discount</Th>
              <Th right>Taxable</Th>
              <Th right>GST</Th>
              {intra ? (
                <>
                  <Th right>CGST</Th>
                  <Th right>SGST</Th>
                </>
              ) : (
                <Th right>IGST</Th>
              )}
              <Th right>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((line, i) => (
              <tr key={i} className="border-b border-neutral-200 align-top">
                <Td>{i + 1}</Td>
                <Td>
                  {line.description}
                  {line.sku ? <span className="block text-neutral-500">SKU {line.sku}</span> : null}
                </Td>
                <Td>{line.hsCode ?? '—'}</Td>
                <Num>{line.quantity}</Num>
                <Num>{money(line.unitPrice)}</Num>
                <Num>{line.discount ? money(line.discount) : '—'}</Num>
                <Num>{money(line.taxableValue)}</Num>
                <Num>{pct(line.rateBps)}</Num>
                {taxCells(line)}
                <Num strong>{money(line.total)}</Num>
              </tr>
            ))}
            {d.shipping ? (
              <tr className="border-b border-neutral-200 align-top">
                <Td>{d.lines.length + 1}</Td>
                <Td>{d.shipping.description}</Td>
                <Td>9965</Td>
                <Num>1</Num>
                <Num>{money(d.shipping.taxableValue)}</Num>
                <Num>—</Num>
                <Num>{money(d.shipping.taxableValue)}</Num>
                <Num>{pct(d.shipping.rateBps)}</Num>
                {taxCells(d.shipping)}
                <Num strong>
                  {money(
                    d.shipping.taxableValue + d.shipping.cgst + d.shipping.sgst + d.shipping.igst,
                  )}
                </Num>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Tax summary by HSN
          </h2>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-600">
                <Th>HSN</Th>
                <Th right>Taxable</Th>
                <Th right>Rate</Th>
                {intra ? (
                  <>
                    <Th right>CGST</Th>
                    <Th right>SGST</Th>
                  </>
                ) : (
                  <Th right>IGST</Th>
                )}
              </tr>
            </thead>
            <tbody>
              {d.summary.map((row, i) => (
                <tr key={i} className="border-b border-neutral-200">
                  <Td>{row.hsCode ?? '—'}</Td>
                  <Num>{money(row.taxableValue)}</Num>
                  <Num>{pct(row.rateBps)}</Num>
                  {taxCells(row)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="min-w-[240px] space-y-1">
          <Total label="Taxable value">{money(d.taxableTotal)}</Total>
          {intra ? (
            <>
              <Total label="CGST">{money(d.cgstTotal)}</Total>
              <Total label="SGST">{money(d.sgstTotal)}</Total>
            </>
          ) : (
            <Total label="IGST">{money(d.igstTotal)}</Total>
          )}
          <div className="flex justify-between gap-6 border-t-2 border-neutral-900 pt-2 text-base font-bold">
            <dt>Total ({d.currency})</dt>
            <dd className="tabular-nums">{money(d.total)}</dd>
          </div>
          {d.giftCardAmount > 0 ? (
            <Total label="Paid by gift card">{money(d.giftCardAmount)}</Total>
          ) : null}
        </dl>
      </section>

      <p className="mt-4 border-y border-neutral-200 py-2 text-neutral-700">
        <span className="text-neutral-500">Amount in words: </span>
        {d.amountInWords}
      </p>

      <footer className="mt-10 flex flex-wrap items-end justify-between gap-6 text-neutral-600">
        <p className="max-w-sm text-[12px]">
          Goods once sold are subject to the store&apos;s return policy. Questions about this
          invoice: {d.seller.email}
        </p>
        <div className="text-right">
          <p>For {d.seller.legalName}</p>
          <div className="mt-10 w-48 border-t border-neutral-400 pt-1 text-[12px]">
            Authorised signatory
          </div>
        </div>
      </footer>
    </article>
  );
}

/**
 * A GST credit note: reduces an issued invoice by a refund. Same plain A4 look as the invoice,
 * with the refund split by HSN and rate.
 */
export function CreditNoteDocument({ note }: { note: CreditNote }) {
  const d = note.data;
  const amount = amountFormatter(d.currency);
  const money = (n: number) => amount.format(n / 100);
  const intra = d.supplyType === 'intra';
  const date = (iso: string) =>
    new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );

  return (
    <article className="mx-auto w-full max-w-[210mm] bg-white text-[13px] leading-5 text-neutral-900 print:max-w-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-neutral-900 pb-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Credit note
          </p>
          {note.cancelledAt ? (
            <p className="mt-1 inline-block rounded border-2 border-red-700 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-red-700">
              Cancelled {date(note.cancelledAt)}: the refund failed
            </p>
          ) : null}
          <h1 className="mt-1 text-xl font-bold">{d.seller.legalName}</h1>
          <p className="mt-2 max-w-sm whitespace-pre-line text-neutral-700">{d.seller.address}</p>
          <p className="mt-2">
            <span className="text-neutral-500">GSTIN </span>
            <span className="font-mono font-semibold">{d.seller.gstin}</span>
          </p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
          <Meta label="Credit note no.">
            <span className="font-mono font-semibold">{note.number}</span>
          </Meta>
          <Meta label="Date">{date(note.issuedAt)}</Meta>
          <Meta label="Against invoice">
            <span className="font-mono">{d.invoiceNumber}</span> · {date(d.invoiceDate)}
          </Meta>
          <Meta label="Order">#{d.orderNumber}</Meta>
          <Meta label="Place of supply">
            {d.placeOfSupply.name}
            {d.placeOfSupply.code ? ` (${d.placeOfSupply.code})` : ''}
          </Meta>
        </dl>
      </header>

      <section className="grid gap-6 border-b border-neutral-200 py-5 sm:grid-cols-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Issued to
          </h2>
          <p className="mt-1 font-semibold">{d.buyer.name}</p>
          {d.buyer.address.map((line, i) => (
            <p key={i} className="text-neutral-700">
              {line}
            </p>
          ))}
          {d.buyer.gstin ? (
            <p className="mt-1">
              <span className="text-neutral-500">GSTIN </span>
              <span className="font-mono font-semibold">{d.buyer.gstin}</span>
            </p>
          ) : null}
        </div>
        <div className="sm:text-right">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Reason
          </h2>
          <p className="mt-1">{d.reason ?? 'Refund'}</p>
        </div>
      </section>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-600">
            <Th>HSN</Th>
            <Th right>Taxable</Th>
            <Th right>GST</Th>
            {intra ? (
              <>
                <Th right>CGST</Th>
                <Th right>SGST</Th>
              </>
            ) : (
              <Th right>IGST</Th>
            )}
            <Th right>Amount</Th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((row, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <Td>{row.hsCode ?? '—'}</Td>
              <Num>{money(row.taxableValue)}</Num>
              <Num>{`${trimZeros(row.rateBps / 100)}%`}</Num>
              {intra ? (
                <>
                  <Num>{money(row.cgst)}</Num>
                  <Num>{money(row.sgst)}</Num>
                </>
              ) : (
                <Num>{money(row.igst)}</Num>
              )}
              <Num strong>{money(row.taxableValue + row.cgst + row.sgst + row.igst)}</Num>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-5 max-w-[280px] space-y-1">
        <Total label="Taxable value">{money(d.taxableTotal)}</Total>
        {intra ? (
          <>
            <Total label="CGST">{money(d.cgstTotal)}</Total>
            <Total label="SGST">{money(d.sgstTotal)}</Total>
          </>
        ) : (
          <Total label="IGST">{money(d.igstTotal)}</Total>
        )}
        <div className="flex justify-between gap-6 border-t-2 border-neutral-900 pt-2 text-base font-bold">
          <dt>Credited ({d.currency})</dt>
          <dd className="tabular-nums">{money(d.total)}</dd>
        </div>
      </dl>

      <p className="mt-4 border-y border-neutral-200 py-2 text-neutral-700">
        <span className="text-neutral-500">Amount in words: </span>
        {d.amountInWords}
      </p>

      <footer className="mt-10 text-right text-neutral-600">
        <p>For {d.seller.legalName}</p>
        <div className="ml-auto mt-10 w-48 border-t border-neutral-400 pt-1 text-[12px]">
          Authorised signatory
        </div>
      </footer>
    </article>
  );
}

function trimZeros(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '');
}

function amountFormatter(currency: string) {
  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`px-2 py-2 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-2 py-2">{children}</td>;
}

function Num({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <td className={`px-2 py-2 text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>
      {children}
    </td>
  );
}

function Total({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}

export type { TaxInvoiceData };
