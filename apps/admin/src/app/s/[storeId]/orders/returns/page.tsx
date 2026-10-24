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
  ViewTabs,
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
      <div className="mb-4">
        <ViewTabs
          label="Return views"
          items={VIEWS.map((v) => ({
            label: v.label,
            href: `${base}/returns?view=${v.key}`,
            active: current.key === v.key,
          }))}
        />
      </div>
      {returns.items.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Nothing here"
          description="Returns customers request appear here."
        />
      ) : (
        <>
          <Table
            head={['Order', 'Customer', 'Items', 'Value', 'Status', 'Requested']}
            numeric={[2, 3]}
          >
            {returns.items.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link
                    href={`${base}/${r.orderId}`}
                    className="font-semibold text-slate-900 hover:text-indigo-600"
                  >
                    #{r.orderNumber}
                  </Link>
                </Td>
                <Td>{r.email}</Td>
                <Td numeric>{r.lines.reduce((n, l) => n + l.quantity, 0)}</Td>
                <Td numeric>{formatMoney(r.suggestedRefund, store.currency)}</Td>
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
