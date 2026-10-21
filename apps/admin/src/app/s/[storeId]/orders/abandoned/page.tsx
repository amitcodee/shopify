import { type AbandonedCheckout, formatMoney, type Paginated } from '@repo/contracts';
import Link from 'next/link';
import {
  Badge,
  type BadgeTone,
  EmptyState,
  formatDateTime,
  PageHeader,
  Pagination,
  Table,
  Td,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';

const RECOVERY: Record<AbandonedCheckout['recoveryStatus'], { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'email scheduled', tone: 'yellow' },
  SENT: { label: 'email sent', tone: 'blue' },
  SKIPPED: { label: 'not emailed', tone: 'gray' },
};

export default async function AbandonedCheckoutsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { storeId } = await params;
  const { page } = await searchParams;
  const [store, checkouts] = await Promise.all([
    getStore(storeId),
    api<Paginated<AbandonedCheckout>>(`/admin/stores/${storeId}/abandoned-checkouts`, {
      query: { page: Number(page) || 1 },
    }),
  ]);
  const base = `/s/${storeId}/orders`;

  return (
    <>
      <PageHeader
        title="Abandoned checkouts"
        description={
          store.abandonedCheckoutDelayHours
            ? `Shoppers who don't pay get a recovery email ${store.abandonedCheckoutDelayHours} hour(s) after checkout.`
            : 'Recovery emails are off. Turn them on in Settings → General.'
        }
        back={{ href: base, label: 'Orders' }}
      />
      {checkouts.items.length === 0 ? (
        <EmptyState
          title="No abandoned checkouts"
          description="Checkouts that expire without payment appear here."
        />
      ) : (
        <>
          <Table head={['Checkout', 'Customer', 'Items', 'Total', 'Recovery']}>
            {checkouts.items.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Link
                    href={`${base}/${c.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {formatDateTime(c.createdAt)}
                  </Link>
                </Td>
                <Td>{c.email}</Td>
                <Td>{c.itemCount}</Td>
                <Td>{formatMoney(c.total, c.currency)}</Td>
                <Td>
                  {c.recoveredOrder ? (
                    <Link href={`${base}/${c.recoveredOrder.id}`} className="hover:underline">
                      <Badge tone="green">recovered · #{c.recoveredOrder.number}</Badge>
                    </Link>
                  ) : (
                    <Badge tone={RECOVERY[c.recoveryStatus].tone}>
                      {RECOVERY[c.recoveryStatus].label}
                    </Badge>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={checkouts.page}
            pageSize={checkouts.pageSize}
            total={checkouts.total}
            hrefFor={(p) => `${base}/abandoned?page=${p}`}
          />
        </>
      )}
    </>
  );
}
