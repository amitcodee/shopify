import { formatMoney, type Paginated, type Return, type ReturnStatus } from '@repo/contracts';
import Link from 'next/link';
import {
  Badge,
  EmptyState,
  formatDateTime,
  PageHeader,
  Pagination,
  Table,
  Td,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';

const VIEWS: { key: ReturnStatus | 'ALL'; label: string }[] = [
  { key: 'REQUESTED', label: 'To review' },
  { key: 'OPEN', label: 'Awaiting items' },
  { key: 'ALL', label: 'All' },
];

export default async function ReturnsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { view = 'REQUESTED', page } = await searchParams;
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0]!;
  const [store, returns] = await Promise.all([
    getStore(storeId),
    api<Paginated<Return>>(`/admin/stores/${storeId}/returns`, {
      query: { status: current.key === 'ALL' ? undefined : current.key, page: Number(page) || 1 },
    }),
  ]);
  const base = `/s/${storeId}/orders`;
  return (
    <>
      <PageHeader title="Returns" back={{ href: base, label: 'Orders' }} />
      <nav aria-label="Return views" className="mb-4 flex gap-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`${base}/returns?view=${v.key}`}
            aria-current={current.key === v.key ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm ${current.key === v.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>
      {returns.items.length === 0 ? (
        <EmptyState title="Nothing here" description="Returns customers request appear here." />
      ) : (
        <>
          <Table head={['Order', 'Customer', 'Items', 'Value', 'Status', 'Requested']}>
            {returns.items.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`${base}/${r.orderId}`} className="font-medium hover:underline">
                    #{r.orderNumber}
                  </Link>
                </Td>
                <Td>{r.email}</Td>
                <Td>{r.lines.reduce((n, l) => n + l.quantity, 0)}</Td>
                <Td>{formatMoney(r.suggestedRefund, store.currency)}</Td>
                <Td>
                  <Badge tone={r.status === 'REQUESTED' ? 'yellow' : 'blue'}>
                    {r.status.toLowerCase()}
                  </Badge>
                </Td>
                <Td>{formatDateTime(r.createdAt)}</Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={returns.page}
            pageSize={returns.pageSize}
            total={returns.total}
            hrefFor={(p) => `${base}/returns?view=${current.key}&page=${p}`}
          />
        </>
      )}
    </>
  );
}
