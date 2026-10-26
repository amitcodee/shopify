import { type Discount, formatMoney } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { ActionForm, Field, SelectField, SubmitButton } from '@/components/form';
import { Badge, Card, EmptyState, formatDateTime, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import {
  createDiscountAction,
  deleteDiscountAction,
  toggleDiscountAction,
} from '../settings/commerce-actions';

function status(d: Discount): { label: string; tone: 'green' | 'gray' | 'yellow' | 'red' } {
  const now = Date.now();
  if (!d.active) return { label: 'Inactive', tone: 'gray' };
  if (d.endsAt && Date.parse(d.endsAt) <= now) return { label: 'Expired', tone: 'red' };
  if (d.startsAt && Date.parse(d.startsAt) > now) return { label: 'Scheduled', tone: 'yellow' };
  if (d.usageLimit !== null && d.usedCount >= d.usageLimit)
    return { label: 'Used up', tone: 'gray' };
  return { label: 'Active', tone: 'green' };
}

export default async function DiscountsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store.permissions.includes('discounts:write')) notFound();
  const discounts = await api<Discount[]>(`/admin/stores/${storeId}/discounts`);
  const money = (n: number) => formatMoney(n, store.currency);
  const describe = (d: Discount) =>
    d.type === 'PERCENTAGE'
      ? `${d.value}% off`
      : d.type === 'FIXED_AMOUNT'
        ? `${money(d.value)} off`
        : 'Free shipping';

  return (
    <>
      <PageHeader title="Discounts" description="Codes customers enter at checkout." />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {discounts.length === 0 ? (
          <EmptyState
            icon="discounts"
            title="No discount codes yet"
            description="Create a code to offer a percentage, a fixed amount or free shipping."
          />
        ) : (
          <Table
            head={[
              'Code',
              'Discount',
              'Conditions',
              'Used',
              'Status',
              <span key="a" className="sr-only">
                Actions
              </span>,
            ]}
            numeric={[3]}
          >
            {discounts.map((d) => {
              const s = status(d);
              return (
                <tr key={d.id}>
                  <Td>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] font-medium text-slate-900 ring-1 ring-slate-200 ring-inset">
                      {d.code}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">{describe(d)}</Td>
                  <Td className="text-slate-500">
                    {[
                      d.minSubtotal !== null ? `Min ${money(d.minSubtotal)}` : null,
                      d.endsAt ? `Ends ${formatDateTime(d.endsAt)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Td>
                  <Td numeric>
                    {d.usedCount}
                    {d.usageLimit !== null ? ` / ${d.usageLimit}` : ''}
                  </Td>
                  <Td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-3">
                      <form action={toggleDiscountAction.bind(null, storeId, d.id, !d.active)}>
                        <button
                          type="submit"
                          className="text-xs font-medium text-indigo-600 hover:underline"
                        >
                          {d.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </form>
                      <form action={deleteDiscountAction.bind(null, storeId, d.id)}>
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
        <Card title="Create discount code" description="Customers enter it at checkout.">
          <ActionForm
            action={createDiscountAction.bind(null, storeId, store.currency)}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"
          >
            <Field name="code" label="Code" required placeholder="SUMMER20" />
            <SelectField
              name="type"
              label="Type"
              defaultValue="PERCENTAGE"
              options={[
                { value: 'PERCENTAGE', label: 'Percentage off' },
                { value: 'FIXED_AMOUNT', label: `Fixed amount off (${store.currency})` },
                { value: 'FREE_SHIPPING', label: 'Free shipping' },
              ]}
            />
            <Field
              name="value"
              label="Value"
              inputMode="decimal"
              placeholder="20"
              hint="Percent or amount; ignored for free shipping."
            />
            <Field name="minSubtotal" label="Minimum order (optional)" inputMode="decimal" />
            <Field name="usageLimit" label="Usage limit (optional)" inputMode="numeric" />
            <Field name="startsAt" label="Starts (optional)" type="datetime-local" />
            <Field name="endsAt" label="Ends (optional)" type="datetime-local" />
            <div className="sm:col-span-2 xl:col-span-1">
              <SubmitButton>Create discount</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
