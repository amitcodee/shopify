import { type AdminCustomer, formatMoney, type Paginated } from '@repo/contracts';
import Link from 'next/link';
import {
  ButtonLink,
  Badge,
  EmptyState,
  formatDateTime,
  PageHeader,
  Pagination,
  SearchInput,
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
          <ButtonLink href={`/s/${storeId}/customers/segments`} variant="secondary" size="sm">
            Segments
          </ButtonLink>
        }
      />
      <form action={base} className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          id="customer-search"
          label="Search customers"
          defaultValue={q}
          placeholder="Name or email"
          className="w-full sm:w-72"
        />
        <p className="text-[13px] text-slate-500 tabular-nums">
          {customers.total} {customers.total === 1 ? 'customer' : 'customers'}
        </p>
      </form>
      {customers.items.length === 0 ? (
        <EmptyState
          icon="customers"
          title="No customers yet"
          description="Customers are added when they check out or create an account."
        />
      ) : (
        <>
          <Table head={['Customer', 'Account', 'Orders', 'Spent', 'Since']} numeric={[2, 3]}>
            {customers.items.map((c) => (
              <tr key={c.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
                    >
                      {(c.name ?? c.email).trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`${base}/${c.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {c.name ?? c.email}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{c.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>{c.hasAccount ? <Badge tone="green">Account</Badge> : <Badge>Guest</Badge>}</Td>
                <Td numeric>{c.ordersCount}</Td>
                <Td numeric className="font-medium text-slate-900">
                  {formatMoney(c.totalSpent, store.currency)}
                </Td>
                <Td className="whitespace-nowrap text-slate-500">{formatDateTime(c.createdAt)}</Td>
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
