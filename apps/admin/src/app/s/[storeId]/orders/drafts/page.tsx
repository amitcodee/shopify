import { type DraftOrderListItem, formatMoney, type Paginated } from '@repo/contracts';
import Link from 'next/link';
import {
  ButtonLink,
  EmptyState,
  formatDateTime,
  PageHeader,
  Pagination,
  Table,
  Td,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { DraftStatusBadge } from './status';

export default async function DraftOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { storeId } = await params;
  const { page } = await searchParams;
  const [store, drafts] = await Promise.all([
    getStore(storeId),
    api<Paginated<DraftOrderListItem>>(`/admin/stores/${storeId}/draft-orders`, {
      query: { page: Number(page) || 1 },
    }),
  ]);
  const base = `/s/${storeId}/orders/drafts`;
  const canWrite = store.permissions.includes('orders:write');

  return (
    <>
      <PageHeader
        title="Draft orders"
        description="Create orders for phone, email or in-person sales, then send an invoice or mark them as paid."
        back={{ href: `/s/${storeId}/orders`, label: 'Orders' }}
        actions={canWrite ? <ButtonLink href={`${base}/new`}>Create order</ButtonLink> : null}
      />
      {drafts.items.length === 0 ? (
        <EmptyState title="No draft orders" description="Draft orders you create appear here." />
      ) : (
        <>
          <Table head={['Draft', 'Customer', 'Status', 'Total', 'Created']}>
            {drafts.items.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link
                    href={`${base}/${d.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    #D{d.number}
                  </Link>
                </Td>
                <Td>{d.email ?? <span className="text-slate-400">—</span>}</Td>
                <Td>
                  <DraftStatusBadge status={d.status} />
                </Td>
                <Td>{formatMoney(d.total, d.currency)}</Td>
                <Td>{formatDateTime(d.createdAt)}</Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={drafts.page}
            pageSize={drafts.pageSize}
            total={drafts.total}
            hrefFor={(p) => `${base}?page=${p}`}
          />
        </>
      )}
    </>
  );
}
