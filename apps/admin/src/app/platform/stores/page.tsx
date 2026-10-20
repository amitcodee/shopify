import type { CurrentUser, Paginated, Plan, PlatformStore } from '@repo/contracts';
import { ActionForm, Field, SelectField, SubmitButton } from '@/components/form';
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
import { getCurrentUser } from '@/lib/session';
import { SmallAction } from '../../s/[storeId]/settings/small-action';
import { reactivateStoreAction, setStorePlanAction, suspendStoreAction } from '../actions';

export default async function PlatformStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page } = await searchParams;
  const [user, stores, plans]: [CurrentUser, Paginated<PlatformStore>, Plan[]] = await Promise.all([
    getCurrentUser(),
    api<Paginated<PlatformStore>>('/platform/stores', {
      query: { q, status, page: Number(page) || 1 },
    }),
    api<Plan[]>('/platform/plans'),
  ]);
  const canAct = user.platformRole === 'SUPER_ADMIN';

  return (
    <>
      <PageHeader title="Stores" />
      <form action="/platform/stores" className="mb-4 flex gap-2">
        <label htmlFor="store-search" className="sr-only">
          Search stores
        </label>
        <input
          id="store-search"
          name="q"
          defaultValue={q}
          placeholder="Name, address or owner email"
          className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <label htmlFor="store-status" className="sr-only">
          Status
        </label>
        <select
          id="store-status"
          name="status"
          defaultValue={status ?? ''}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          Filter
        </button>
      </form>
      {stores.items.length === 0 ? (
        <EmptyState title="No stores found" />
      ) : (
        <>
          <Table
            head={[
              'Store',
              'Owner',
              'Plan',
              'Usage',
              'Payments',
              'Status',
              canAct ? 'Actions' : '',
            ]}
          >
            {stores.items.map((s) => (
              <tr key={s.id}>
                <Td>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {s.subdomain} · {formatDateTime(s.createdAt)}
                  </p>
                </Td>
                <Td>{s.ownerEmail}</Td>
                <Td>
                  {s.plan}{' '}
                  <span className="text-xs text-slate-500">
                    ({s.subscriptionStatus.toLowerCase()})
                  </span>
                </Td>
                <Td className="text-xs">
                  {s.usage.products} products · {s.usage.staff} staff · {s.usage.ordersThisMonth}{' '}
                  orders/mo
                </Td>
                <Td>
                  {s.paymentsStatus === 'ACTIVE' ? (
                    <Badge tone="green">Active</Badge>
                  ) : s.paymentsStatus === 'RESTRICTED' ? (
                    <Badge tone="red">Restricted</Badge>
                  ) : s.paymentsStatus ? (
                    <Badge tone="yellow">{s.paymentsStatus.toLowerCase()}</Badge>
                  ) : (
                    <Badge>Not set up</Badge>
                  )}
                </Td>
                <Td>
                  {s.status === 'ACTIVE' ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="red">Suspended</Badge>
                  )}
                  {s.suspendedReason ? (
                    <p className="mt-1 max-w-48 text-xs text-slate-500">{s.suspendedReason}</p>
                  ) : null}
                </Td>
                <Td>
                  {canAct ? (
                    <div className="space-y-2">
                      {s.status === 'ACTIVE' ? (
                        <details>
                          <summary className="cursor-pointer text-sm text-red-600">
                            Suspend…
                          </summary>
                          <ActionForm
                            action={suspendStoreAction.bind(null, s.id)}
                            className="mt-2 space-y-2"
                          >
                            <Field name="reason" label="Reason" required minLength={3} />
                            <SubmitButton variant="danger">Suspend store</SubmitButton>
                          </ActionForm>
                        </details>
                      ) : (
                        <SmallAction
                          action={reactivateStoreAction.bind(null, s.id)}
                          label="Reactivate"
                        />
                      )}
                      <details>
                        <summary className="cursor-pointer text-sm text-indigo-600">
                          Change plan…
                        </summary>
                        <ActionForm
                          action={setStorePlanAction.bind(null, s.id)}
                          className="mt-2 space-y-2"
                        >
                          <SelectField
                            name="planId"
                            label="Plan"
                            options={plans.map((p) => ({ value: p.id, label: p.name }))}
                          />
                          <SubmitButton variant="secondary">Assign plan</SubmitButton>
                        </ActionForm>
                      </details>
                    </div>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={stores.page}
            pageSize={stores.pageSize}
            total={stores.total}
            hrefFor={(n) =>
              `/platform/stores?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(n) })}`
            }
          />
        </>
      )}
    </>
  );
}
