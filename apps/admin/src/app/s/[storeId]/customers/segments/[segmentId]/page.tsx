import { formatMoney, type Segment, type SegmentMembers } from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  buttonClass,
  Card,
  formatDateTime,
  PageHeader,
  Pagination,
  Table,
  Td,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../../confirm-button';
import { deleteSegmentAction, saveSegmentAction } from '../actions';
import { SegmentForm, segmentRows } from '../segment-form';

export default async function SegmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string; segmentId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { storeId, segmentId } = await params;
  const { page } = await searchParams;
  const base = `/admin/stores/${storeId}/segments/${segmentId}`;
  let segment: Segment;
  try {
    segment = await api<Segment>(base);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [store, members] = await Promise.all([
    getStore(storeId),
    api<SegmentMembers>(`${base}/customers`, { query: { page: Number(page) || 1 } }),
  ]);
  const canWrite = store.permissions.includes('customers:write');
  const href = `/s/${storeId}/customers/segments/${segmentId}`;

  return (
    <>
      <PageHeader
        title={segment.name}
        description={`${segment.customerCount} customer(s) match right now.`}
        back={{ href: `/s/${storeId}/customers/segments`, label: 'Segments' }}
        actions={
          <a href={`${href}/export`} className={buttonClass('secondary')} download>
            Export CSV
          </a>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <Card title="Customers">
          <Table head={['Customer', 'Orders', 'Spent', 'Last order']}>
            {members.items.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Link
                    href={`/s/${storeId}/customers/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name ?? c.email}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {c.email} {c.acceptsMarketing ? <Badge tone="green">subscribed</Badge> : null}
                  </p>
                </Td>
                <Td>{c.ordersCount}</Td>
                <Td>{formatMoney(c.totalSpent, store.currency)}</Td>
                <Td>{c.lastOrderAt ? formatDateTime(c.lastOrderAt) : '—'}</Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={members.page}
            pageSize={members.pageSize}
            total={members.total}
            hrefFor={(p) => `${href}?page=${p}`}
          />
        </Card>
        <div className="space-y-6">
          <Card title="Conditions">
            <SegmentForm
              key={segment.updatedAt}
              segment={segment}
              currency={store.currency}
              canWrite={canWrite}
              action={saveSegmentAction.bind(
                null,
                storeId,
                segmentId,
                segmentRows(segment),
                store.currency,
              )}
            />
          </Card>
          {canWrite ? (
            <Card title="Danger zone">
              <ConfirmButton
                action={deleteSegmentAction.bind(null, storeId, segmentId)}
                label="Delete segment"
                confirmLabel="Yes, delete segment"
              />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
