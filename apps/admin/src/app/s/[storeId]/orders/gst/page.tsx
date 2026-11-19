import {
  formatMoney,
  type GstSettings,
  type Gstr1Report,
  type Gstr1Section,
  gstPlace,
} from '@repo/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';
import {
  Alert,
  ButtonLink,
  buttonClass,
  Card,
  EmptyState,
  inputClass,
  PageHeader,
  Table,
  Td,
} from '@/components/ui';
import { api } from '@/lib/api';
import { OrdersNav } from '../orders-nav';

/** Rows shown per table on the page; the CSV always has all of them. */
const SHOWN = 50;

function shiftMonth(month: string, by: number): string {
  const year = Number(month.slice(0, 4));
  const index = year * 12 + Number(month.slice(5, 7)) - 1 + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** GSTR-1 for month M is due on the 11th of the next month. */
function dueDate(month: string): string {
  return new Date(`${shiftMonth(month, 1)}-11T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const rate = (bps: number) => `${bps / 100}%`;

function Section({
  title,
  table,
  description,
  count,
  download,
  children,
}: {
  title: string;
  table: string;
  description: string;
  count: number;
  download: ReactNode;
  children: ReactNode;
}) {
  // Empty tables are listed together at the end instead of taking a card each.
  if (count === 0) return null;
  return (
    <Card title={`${title} · Table ${table}`} description={description} actions={download} flush>
      {children}
      {count > SHOWN ? (
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
          Showing {SHOWN} of {count} rows. The CSV has all of them.
        </p>
      ) : null}
    </Card>
  );
}

export default async function GstReturnsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { storeId } = await params;
  const { month } = await searchParams;
  const valid = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  const [report, gst] = await Promise.all([
    api<Gstr1Report>(`/admin/stores/${storeId}/gst-returns/gstr1`, { query: { month: valid } }),
    api<GstSettings>(`/admin/stores/${storeId}/gst`),
  ]);
  const base = `/s/${storeId}/orders/gst`;
  const money = (minor: number) => formatMoney(minor, report.currency, 'en-IN');
  const csv = (section: Gstr1Section) => (
    // A route handler download: plain <a>, no client-side navigation.
    <a
      href={`${base}/export?month=${report.month}&section=${section}`}
      className={buttonClass('secondary', 'sm')}
      download
    >
      <Icon name="download" className="-ml-0.5 h-4 w-4" />
      CSV
    </a>
  );
  const current = new Date().toISOString().slice(0, 7);
  const t = report.totals;
  const hsnB2b = report.hsn.filter((r) => r.audience === 'b2b');
  const hsnB2c = report.hsn.filter((r) => r.audience === 'b2c');
  const empty = (
    [
      ['B2B invoices (4A)', report.b2b.length],
      ['B2C large (5)', report.b2cl.length],
      ['B2C small (7)', report.b2cs.length],
      ['Exports (6A)', report.exports.length],
      ['Credit notes to businesses (9B)', report.cdnr.length],
      ['Credit notes to consumers (9B)', report.cdnur.length],
      ['HSN summary B2B (12)', hsnB2b.length],
      ['HSN summary B2C (12)', hsnB2c.length],
      ['Documents issued (13)', report.documents.length],
    ] as const
  )
    .filter(([, n]) => n === 0)
    .map(([label]) => label);

  const header = (
    <>
      <PageHeader
        title="GST returns"
        description="Your tax invoices and credit notes for a month, sorted into the tables of GSTR-1. Download the GSTR-1 JSON for the portal's offline upload (check it in the GST Offline Tool first), or each table as CSV in the tool's layout."
      />
      <OrdersNav storeId={storeId} active="gst" />
    </>
  );

  if (!gst.registration && t.invoices === 0 && t.creditNotes === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon="chart"
          title="Add your GSTIN first"
          description="GST returns are built from the tax invoices your store issues. Add your GST registration and every paid order gets an invoice."
          action={
            <ButtonLink href={`/s/${storeId}/settings/taxes`} size="sm">
              Go to Settings → Taxes
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`${base}?month=${shiftMonth(report.month, -1)}`}
            className={buttonClass('ghost', 'sm')}
            aria-label="Previous month"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
          </Link>
          <h2 className="min-w-36 text-center text-base font-semibold text-slate-900">
            {monthLabel(report.month)}
          </h2>
          <Link
            href={`${base}?month=${shiftMonth(report.month, 1)}`}
            className={buttonClass('ghost', 'sm')}
            aria-label="Next month"
            aria-disabled={report.month >= current}
            tabIndex={report.month >= current ? -1 : undefined}
            style={report.month >= current ? { pointerEvents: 'none', opacity: 0.4 } : undefined}
          >
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
        <form className="flex items-center gap-2" action={base}>
          <label htmlFor="gst-month" className="text-[13px] text-slate-500">
            Tax period
          </label>
          <input
            id="gst-month"
            type="month"
            name="month"
            defaultValue={report.month}
            max={current}
            min="2017-07"
            className={`${inputClass} h-8 w-40`}
          />
          <button type="submit" className={buttonClass('secondary', 'sm')}>
            Show
          </button>
          {t.invoices + t.creditNotes > 0 ? (
            // A route handler download: plain <a>, no client-side navigation.
            <a
              href={`${base}/export?month=${report.month}&format=json`}
              className={buttonClass('primary', 'sm')}
              download
              title="GSTR-1 JSON for the GST portal (Prepare offline → Upload). Open it in the GST Offline Tool first to check it."
            >
              <Icon name="download" className="-ml-0.5 h-4 w-4" />
              GSTR-1 JSON
            </a>
          ) : null}
        </form>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { term: 'Invoices', value: String(t.invoices) },
          { term: 'Credit notes', value: String(t.creditNotes) },
          { term: 'Taxable value (net)', value: money(t.taxableValue) },
          { term: 'IGST', value: money(t.igst) },
          { term: 'CGST', value: money(t.cgst) },
          { term: 'SGST / UTGST', value: money(t.sgst) },
        ].map((k) => (
          <div
            key={k.term}
            className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-card"
          >
            <dt className="text-xs font-medium text-slate-500">{k.term}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{k.value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-4">
        {report.warnings.length > 0 ? (
          <Alert tone="warning">
            <p className="font-medium">Check before filing</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {t.invoices + t.creditNotes > 0 ? (
          <Card
            title="GSTR-3B · Outward supplies"
            description="What goes into tables 3.1 and 3.2 of your monthly GSTR-3B, after credit notes. Input tax credit (table 4) comes from your purchases, which this store does not track."
            flush
          >
            <Table
              bare
              head={[
                'Table',
                'Nature of supplies',
                'Taxable value',
                'IGST',
                'CGST',
                'SGST / UTGST',
              ]}
              numeric={[2, 3, 4, 5]}
            >
              {(
                [
                  [
                    '3.1(a)',
                    'Outward taxable supplies (other than zero, nil rated and exempted)',
                    report.gstr3b.outwardTaxable,
                  ],
                  ['3.1(b)', 'Outward taxable supplies (zero rated)', report.gstr3b.zeroRated],
                  [
                    '3.1(c)',
                    'Other outward supplies (nil rated, exempted)',
                    report.gstr3b.nilRated,
                  ],
                ] as const
              ).map(([table, label, r]) => (
                <tr key={table}>
                  <Td className="font-mono text-xs">{table}</Td>
                  <Td>{label}</Td>
                  <Td numeric>{money(r.taxableValue)}</Td>
                  <Td numeric>{money(r.igst)}</Td>
                  <Td numeric>{money(r.cgst)}</Td>
                  <Td numeric>{money(r.sgst)}</Td>
                </tr>
              ))}
            </Table>
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="text-[13px] font-medium text-slate-900">
                3.2 · Inter-state supplies to unregistered persons
              </p>
              {report.gstr3b.interStateUnregistered.length === 0 ? (
                <p className="mt-1 text-[13px] text-slate-500">None this month.</p>
              ) : (
                <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                  {report.gstr3b.interStateUnregistered.map((r) => (
                    <li
                      key={r.placeOfSupply.code ?? 'none'}
                      className="flex justify-between gap-3 rounded-md bg-slate-50 px-3 py-1.5"
                    >
                      <span className="text-slate-700">
                        {gstPlace(r.placeOfSupply) || 'Place not given'}
                      </span>
                      <span className="text-slate-900 tabular-nums">
                        {money(r.taxableValue)}{' '}
                        <span className="text-slate-500">· IGST {money(r.igst)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        ) : null}

        <Section
          title="B2B invoices"
          table="4A"
          description="Sales to buyers who gave a GSTIN at checkout or on a draft order. They claim input tax credit from these."
          count={report.b2b.length}
          download={csv('b2b')}
        >
          <Table
            bare
            head={[
              'Buyer',
              'Invoice',
              'Place of supply',
              'Rate',
              'Taxable value',
              'Tax',
              'Invoice value',
            ]}
            numeric={[3, 4, 5, 6]}
          >
            {report.b2b.slice(0, SHOWN).map((r) => (
              <tr key={`${r.invoiceNumber}-${r.rateBps}`}>
                <Td>
                  <span className="block font-medium text-slate-900">{r.name}</span>
                  <span className="font-mono text-xs text-slate-500">{r.gstin}</span>
                </Td>
                <Td>
                  <span className="block font-mono text-xs text-slate-900">{r.invoiceNumber}</span>
                  <span className="text-xs text-slate-500">{r.invoiceDate}</span>
                </Td>
                <Td>{gstPlace(r.placeOfSupply) || '—'}</Td>
                <Td numeric>{rate(r.rateBps)}</Td>
                <Td numeric>{money(r.taxableValue)}</Td>
                <Td numeric>{money(r.igst + r.cgst + r.sgst)}</Td>
                <Td numeric>{money(r.invoiceValue)}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section
          title="B2C large"
          table="5"
          description="Consumer invoices delivered to another state, above ₹1,00,000 each. Reported invoice by invoice."
          count={report.b2cl.length}
          download={csv('b2cl')}
        >
          <Table
            bare
            head={[
              'Invoice',
              'Date',
              'Place of supply',
              'Rate',
              'Taxable value',
              'IGST',
              'Invoice value',
            ]}
            numeric={[3, 4, 5, 6]}
          >
            {report.b2cl.slice(0, SHOWN).map((r) => (
              <tr key={`${r.invoiceNumber}-${r.rateBps}`}>
                <Td className="font-mono text-xs">{r.invoiceNumber}</Td>
                <Td>{r.invoiceDate}</Td>
                <Td>{gstPlace(r.placeOfSupply) || '—'}</Td>
                <Td numeric>{rate(r.rateBps)}</Td>
                <Td numeric>{money(r.taxableValue)}</Td>
                <Td numeric>{money(r.igst)}</Td>
                <Td numeric>{money(r.invoiceValue)}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section
          title="B2C small"
          table="7"
          description="All other consumer sales, totalled by state and rate, after this month's credit notes on them."
          count={report.b2cs.length}
          download={csv('b2cs')}
        >
          <Table
            bare
            head={['Place of supply', 'Supply', 'Rate', 'Taxable value', 'IGST', 'CGST', 'SGST']}
            numeric={[2, 3, 4, 5, 6]}
          >
            {report.b2cs.slice(0, SHOWN).map((r) => (
              <tr key={`${r.supplyType}-${r.placeOfSupply.code}-${r.rateBps}`}>
                <Td>{gstPlace(r.placeOfSupply) || 'Not given'}</Td>
                <Td>{r.supplyType === 'intra' ? 'Within state' : 'Other state'}</Td>
                <Td numeric>{rate(r.rateBps)}</Td>
                <Td numeric>{money(r.taxableValue)}</Td>
                <Td numeric>{money(r.igst)}</Td>
                <Td numeric>{money(r.cgst)}</Td>
                <Td numeric>{money(r.sgst)}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section
          title="Exports"
          table="6A"
          description="Orders delivered outside India. Add the port code and shipping bill details for goods before filing."
          count={report.exports.length}
          download={csv('exp')}
        >
          <Table
            bare
            head={['Invoice', 'Date', 'Type', 'Rate', 'Taxable value', 'IGST', 'Invoice value']}
            numeric={[3, 4, 5, 6]}
          >
            {report.exports.slice(0, SHOWN).map((r) => (
              <tr key={`${r.invoiceNumber}-${r.rateBps}`}>
                <Td className="font-mono text-xs">{r.invoiceNumber}</Td>
                <Td>{r.invoiceDate}</Td>
                <Td>{r.exportType === 'WPAY' ? 'With IGST' : 'Without IGST (LUT)'}</Td>
                <Td numeric>{rate(r.rateBps)}</Td>
                <Td numeric>{money(r.taxableValue)}</Td>
                <Td numeric>{money(r.igst)}</Td>
                <Td numeric>{money(r.invoiceValue)}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section
          title="Credit notes to businesses"
          table="9B"
          description="Refunds on B2B invoices."
          count={report.cdnr.length}
          download={csv('cdnr')}
        >
          <Table
            bare
            head={['Buyer', 'Credit note', 'Against invoice', 'Rate', 'Taxable value', 'Tax']}
            numeric={[3, 4, 5]}
          >
            {report.cdnr.slice(0, SHOWN).map((r) => (
              <tr key={`${r.noteNumber}-${r.rateBps}`}>
                <Td>
                  <span className="block font-medium text-slate-900">{r.name}</span>
                  <span className="font-mono text-xs text-slate-500">{r.gstin}</span>
                </Td>
                <Td>
                  <span className="block font-mono text-xs text-slate-900">{r.noteNumber}</span>
                  <span className="text-xs text-slate-500">{r.noteDate}</span>
                </Td>
                <Td className="font-mono text-xs">{r.invoiceNumber}</Td>
                <Td numeric>{rate(r.rateBps)}</Td>
                <Td numeric>{money(r.taxableValue)}</Td>
                <Td numeric>{money(r.igst + r.cgst + r.sgst)}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section
          title="Credit notes to consumers"
          table="9B"
          description="Refunds on B2C large and export invoices. Refunds on smaller consumer sales are taken off B2C small instead."
          count={report.cdnur.length}
          download={csv('cdnur')}
        >
          <Table
            bare
            head={['Credit note', 'Type', 'Against invoice', 'Rate', 'Taxable value', 'IGST']}
            numeric={[3, 4, 5]}
          >
            {report.cdnur.slice(0, SHOWN).map((r) => (
              <tr key={`${r.noteNumber}-${r.rateBps}`}>
                <Td>
                  <span className="block font-mono text-xs text-slate-900">{r.noteNumber}</span>
                  <span className="text-xs text-slate-500">{r.noteDate}</span>
                </Td>
                <Td>{r.urType}</Td>
                <Td className="font-mono text-xs">{r.invoiceNumber}</Td>
                <Td numeric>{rate(r.rateBps)}</Td>
                <Td numeric>{money(r.taxableValue)}</Td>
                <Td numeric>{money(r.igst)}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        {(
          [
            ['B2B', 'hsn_b2b', hsnB2b, 'Sales to registered businesses, by HSN/SAC code and rate.'],
            ['B2C', 'hsn_b2c', hsnB2c, 'Sales to consumers and exports, by HSN/SAC code and rate.'],
          ] as const
        ).map(([label, key, rows, description]) => (
          <Section
            key={key}
            title={`HSN summary (${label})`}
            table="12"
            description={`${description} Net of credit notes; quantities count items sold.`}
            count={rows.length}
            download={csv(key)}
          >
            <Table
              bare
              head={[
                'HSN / SAC',
                'Description',
                'Qty',
                'Rate',
                'Taxable value',
                'Tax',
                'Total value',
              ]}
              numeric={[2, 3, 4, 5, 6]}
            >
              {rows.slice(0, SHOWN).map((r) => (
                <tr key={`${r.hsCode}-${r.rateBps}`}>
                  <Td className="font-mono text-xs">
                    {r.hsCode ?? <span className="font-sans text-amber-700">Missing</span>}
                  </Td>
                  <Td>{r.description}</Td>
                  <Td numeric>{r.uqc === 'NA' ? '—' : `${r.quantity} ${r.uqc}`}</Td>
                  <Td numeric>{rate(r.rateBps)}</Td>
                  <Td numeric>{money(r.taxableValue)}</Td>
                  <Td numeric>{money(r.igst + r.cgst + r.sgst)}</Td>
                  <Td numeric>{money(r.totalValue)}</Td>
                </tr>
              ))}
            </Table>
          </Section>
        ))}

        <Section
          title="Documents issued"
          table="13"
          description="Number ranges of the invoices and credit notes issued this month."
          count={report.documents.length}
          download={csv('docs')}
        >
          <Table bare head={['Document', 'From', 'To', 'Total', 'Cancelled']} numeric={[3, 4]}>
            {report.documents.map((d) => (
              <tr key={`${d.nature}-${d.from}`}>
                <Td>{d.nature === 'invoice' ? 'Invoices for outward supply' : 'Credit notes'}</Td>
                <Td className="font-mono text-xs">{d.from}</Td>
                <Td className="font-mono text-xs">{d.to}</Td>
                <Td numeric>{d.total}</Td>
                <Td numeric>{d.cancelled}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        {empty.length > 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-4 text-sm">
            <p className="font-medium text-slate-900">Nothing to report this month</p>
            <p className="mt-1 text-slate-500">{empty.join(' · ')}</p>
          </div>
        ) : null}

        <p className="text-xs leading-5 text-slate-500">
          GSTR-1 for {monthLabel(report.month)} is due by {dueDate(report.month)} for monthly filers
          (quarterly QRMP filers report by the 13th after the quarter). This page prepares the
          figures from the documents your store issued; it does not file the return. Check them
          against your books, and add sales made outside this store, before you file on the GST
          portal.
        </p>
      </div>
    </>
  );
}
