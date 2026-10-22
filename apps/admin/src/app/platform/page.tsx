import { formatMoney, type PlatformOverview } from '@repo/contracts';
import { Card, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default async function PlatformOverviewPage() {
  const o = await api<PlatformOverview>('/platform/overview');
  return (
    <>
      <PageHeader title="Platform overview" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={formatMoney(o.mrr, 'USD')} />
        <Stat
          label="Stores"
          value={`${o.stores.active} active · ${o.stores.suspended} suspended`}
        />
        <Stat label="Merchants / users" value={`${o.merchants} / ${o.users}`} />
        <Stat label="Paid orders (30d)" value={o.paidOrders30d} />
        <Stat label="Stores accepting payments" value={o.storesAcceptingPayments} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Stores by plan">
          <Table head={['Plan', 'Stores']}>
            {o.planBreakdown.map((p) => (
              <tr key={p.plan}>
                <Td>{p.plan}</Td>
                <Td>{p.stores}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Gross merchandise volume (30d)">
          {o.gmv30d.length === 0 ? (
            <p className="text-sm text-slate-500">No paid orders yet.</p>
          ) : (
            <Table head={['Currency', 'GMV']}>
              {o.gmv30d.map((g) => (
                <tr key={g.currency}>
                  <Td>{g.currency}</Td>
                  <Td>{formatMoney(g.amount, g.currency)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Platform transaction fees (30d)">
          {o.fees30d.length === 0 ? (
            <p className="text-sm text-slate-500">No fees collected yet.</p>
          ) : (
            <Table head={['Currency', 'Fees']}>
              {o.fees30d.map((f) => (
                <tr key={f.currency}>
                  <Td>{f.currency}</Td>
                  <Td>{formatMoney(f.amount, f.currency)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
