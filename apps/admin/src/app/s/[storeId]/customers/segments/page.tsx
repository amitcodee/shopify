import { describeCondition, formatMoney, type Segment } from '@repo/contracts';
import Link from 'next/link';
import { ButtonLink, EmptyState, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';

export default async function SegmentsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, segments] = await Promise.all([
    getStore(storeId),
    api<Segment[]>(`/admin/stores/${storeId}/segments`),
  ]);
  const base = `/s/${storeId}/customers/segments`;
  const money = (n: number) => formatMoney(n, store.currency);
  return (
    <>
      <PageHeader
        title="Customer segments"
        description="Saved groups of customers, e.g. repeat buyers or customers who haven't ordered in a while."
        back={{ href: `/s/${storeId}/customers`, label: 'Customers' }}
        actions={
          store.permissions.includes('customers:write') ? (
            <ButtonLink href={`${base}/new`}>Create segment</ButtonLink>
          ) : null
        }
      />
      {segments.length === 0 ? (
        <EmptyState
          title="No segments yet"
          description="Create a segment to find customers by orders, spend, recency or consent."
        />
      ) : (
        <Table head={['Segment', 'Conditions', 'Customers']}>
          {segments.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link
                  href={`${base}/${s.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {s.name}
                </Link>
              </Td>
              <Td className="text-xs text-slate-600">
                {s.conditions.length
                  ? s.conditions.map((c) => describeCondition(c, money)).join(' · ')
                  : 'All customers'}
              </Td>
              <Td>{s.customerCount}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
