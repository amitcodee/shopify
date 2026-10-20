import type { TaxRate } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton } from '@/components/form';
import { Card, EmptyState, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { deleteTaxRateAction, saveTaxRateAction } from '../commerce-actions';

export default async function TaxesPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, rates] = await Promise.all([
    getStore(storeId),
    api<TaxRate[]>(`/admin/stores/${storeId}/tax-rates`),
  ]);
  const canEdit = store.permissions.includes('settings:write');

  return (
    <div className="space-y-6">
      <Card
        title="Tax rates"
        description="Charged at checkout on taxable products. A region rate overrides the country rate."
      >
        {rates.length === 0 ? (
          <EmptyState
            title="No taxes configured"
            description="Orders are not taxed until you add a rate."
          />
        ) : (
          <Table head={['Country', 'Region', 'Name', 'Rate', 'Shipping', '']}>
            {rates.map((r) => (
              <tr key={r.id}>
                <Td>{r.country}</Td>
                <Td>{r.region || 'All'}</Td>
                <Td>{r.name}</Td>
                <Td>{(r.rateBps / 100).toFixed(2)}%</Td>
                <Td>{r.appliesToShipping ? 'Taxed' : '—'}</Td>
                <Td>
                  {canEdit ? (
                    <form action={deleteTaxRateAction.bind(null, storeId, r.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {canEdit ? (
        <Card title="Add or update a rate">
          <ActionForm
            action={saveTaxRateAction.bind(null, storeId)}
            className="grid max-w-2xl gap-3 sm:grid-cols-4"
          >
            <Field name="country" label="Country" required placeholder="US" maxLength={2} />
            <Field name="region" label="Region (optional)" placeholder="CA" />
            <Field name="name" label="Name" required placeholder="Sales tax" />
            <Field name="percent" label="Rate %" required inputMode="decimal" placeholder="8.25" />
            <div className="sm:col-span-4">
              <CheckboxField name="appliesToShipping" label="Also tax shipping" />
            </div>
            <div className="sm:col-span-4">
              <SubmitButton>Save rate</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      ) : null}
    </div>
  );
}
