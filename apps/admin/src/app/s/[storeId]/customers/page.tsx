import { type AdminCustomer, formatMoney, type Paginated } from '@repo/contracts';
import Link from 'next/link';
import {
  ButtonLink,
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

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { q, page } = await searchParams;
  const store = await getStore(storeId);
  const customers = await api<Paginated<AdminCustomer>>(`/admin/stores/${storeId}/customers`, {
    query: { q, page: Number(page) || 1 },
  });
  const base = `/s/${storeId}/customers`;

  return (
    <>
      <PageHeader
        title="Customers"
        actions={
          <ButtonLink href={`/s/${storeId}/customers/segments`} variant="secondary">
            Segments
          </ButtonLink>
        }
      />
      <form action={base} className="mb-4">
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <input
          id="customer-search"
          name="q"
          defaultValue={q}
          placeholder="Name or email"
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </form>
      {customers.items.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Customers are added when they check out or create an account."
        />
      ) : (
        <>
          <Table head={['Customer', 'Account', 'Orders', 'Spent', 'Since']}>
            {customers.items.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <Td>
                  <Link
                    href={`${base}/${c.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {c.name ?? c.email}
                  </Link>
                  <p className="text-xs text-slate-500">{c.email}</p>
                </Td>
                <Td>{c.hasAccount ? <Badge tone="green">Account</Badge> : <Badge>Guest</Badge>}</Td>
                <Td>{c.ordersCount}</Td>
                <Td>{formatMoney(c.totalSpent, store.currency)}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(c.createdAt)}</Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={customers.page}
            pageSize={customers.pageSize}
            total={customers.total}
            hrefFor={(n) =>
              `${base}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`
            }
          />
        </>
      )}
    </>
  );
}
