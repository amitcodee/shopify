import { formatMoney, type GiftCard, type Paginated } from '@repo/contracts';
import Link from 'next/link';
import { ActionForm, CheckboxField, Field, SubmitButton } from '@/components/form';
import { Card, EmptyState, PageHeader, Pagination, SearchInput, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { issueGiftCardAction } from './actions';
import { GiftCardStatusBadge } from './status';

export default async function GiftCardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { q, page } = await searchParams;
  const [store, cards] = await Promise.all([
    getStore(storeId),
    api<Paginated<GiftCard>>(`/admin/stores/${storeId}/gift-cards`, {
      query: { q, page: Number(page) || 1 },
    }),
  ]);
  const base = `/s/${storeId}/gift-cards`;
  const canWrite = store.permissions.includes('orders:write');

  return (
    <>
      <PageHeader
        title="Gift cards"
        description="Store credit customers spend at checkout. Codes are shown only once, when issued."
      />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <form action={base}>
            <SearchInput
              id="gift-card-search"
              label="Search gift cards"
              defaultValue={q}
              placeholder="Last 4 characters or customer email"
              className="w-full max-w-sm"
            />
          </form>
          {cards.items.length === 0 ? (
            <EmptyState
              icon="giftCards"
              title={q ? 'No matching gift cards' : 'No gift cards yet'}
              description="Issue a gift card to give a customer store credit."
            />
          ) : (
            <>
              <Table head={['Code', 'Customer', 'Status', 'Balance', 'Expires']} numeric={[3]}>
                {cards.items.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <Link
                        href={`${base}/${c.id}`}
                        className="font-mono font-medium whitespace-nowrap text-slate-900 hover:text-indigo-600"
                      >
                        •••• {c.lastCharacters}
                      </Link>
                    </Td>
                    <Td>{c.customerEmail ?? <span className="text-slate-400">—</span>}</Td>
                    <Td>
                      <GiftCardStatusBadge status={c.status} />
                    </Td>
                    <Td numeric>
                      <span className="font-medium text-slate-900">
                        {formatMoney(c.balance, c.currency)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {' '}
                        / {formatMoney(c.initialValue, c.currency)}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-slate-500">{c.expiresOn ?? 'Never'}</Td>
                  </tr>
                ))}
              </Table>
              <Pagination
                page={cards.page}
                pageSize={cards.pageSize}
                total={cards.total}
                hrefFor={(p) =>
                  `${base}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`
                }
              />
            </>
          )}
        </div>
        {canWrite ? (
          <Card title="Issue gift card">
            <ActionForm action={issueGiftCardAction.bind(null, storeId, store.currency)}>
              <Field
                name="initialValue"
                label={`Value (${store.currency})`}
                inputMode="decimal"
                required
              />
              <Field name="customerEmail" label="Customer email (optional)" type="email" />
              <CheckboxField name="notifyCustomer" label="Email the gift card to the customer" />
              <Field name="expiresOn" label="Expires on (optional)" type="date" />
              <Field
                name="code"
                label="Custom code (optional)"
                hint="8–20 letters and digits. Leave empty for a secure random code."
              />
              <Field name="note" label="Internal note (optional)" maxLength={500} />
              <SubmitButton>Issue gift card</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </>
  );
}
