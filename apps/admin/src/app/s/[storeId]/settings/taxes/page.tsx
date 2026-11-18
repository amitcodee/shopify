import { financialYearOf, invoiceNumber, type GstSettings, type TaxRate } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton, TextAreaField } from '@/components/form';
import { Card, EmptyState, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import {
  deleteTaxRateAction,
  removeGstAction,
  saveGstAction,
  saveTaxRateAction,
} from '../commerce-actions';

export default async function TaxesPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, rates, gst] = await Promise.all([
    getStore(storeId),
    api<TaxRate[]>(`/admin/stores/${storeId}/tax-rates`),
    api<GstSettings>(`/admin/stores/${storeId}/gst`),
  ]);
  const canEdit = store.permissions.includes('settings:write');
  const reg = gst.registration;

  return (
    <div className="space-y-6">
      <Card
        title="GST invoices"
        description="Selling in India with a GSTIN? Add it here and every paid order gets a numbered tax invoice, with CGST and SGST inside your state and IGST for other states."
      >
        {reg ? (
          <dl className="mb-5 grid gap-x-6 gap-y-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">GSTIN</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900">{reg.gstin}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">State</dt>
              <dd className="mt-0.5 text-slate-900">
                {reg.stateName} ({reg.stateCode})
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Legal name
              </dt>
              <dd className="mt-0.5 text-slate-900">{reg.legalName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Invoice numbers
              </dt>
              <dd className="mt-0.5 font-mono text-slate-900">
                {invoiceNumber(
                  reg.invoicePrefix,
                  financialYearOf(new Date().getFullYear(), new Date().getMonth() + 1),
                  1,
                )}
                , then 0002, …
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Not registered: orders get no tax invoice. Leave this empty if your business has no
            GSTIN.
          </p>
        )}
        {canEdit ? (
          <ActionForm
            action={saveGstAction.bind(null, storeId)}
            className="grid max-w-2xl gap-3 sm:grid-cols-2"
          >
            <Field
              name="gstin"
              label="GSTIN"
              required
              defaultValue={reg?.gstin}
              placeholder="27ABCDE1234F1Z5"
              maxLength={15}
              autoCapitalize="characters"
              hint="15 characters. The first two digits set your state."
            />
            <Field
              name="invoicePrefix"
              label="Invoice prefix"
              defaultValue={reg?.invoicePrefix ?? 'INV'}
              placeholder="INV"
              maxLength={5}
              hint="Up to 5 letters or digits. Numbers restart every April."
            />
            <div className="sm:col-span-2">
              <Field
                name="legalName"
                label="Legal name"
                required
                defaultValue={reg?.legalName}
                placeholder="As on your GST certificate"
              />
            </div>
            <div className="sm:col-span-2">
              <TextAreaField
                name="address"
                label="Registered address"
                required
                rows={3}
                defaultValue={reg?.address}
                placeholder="Principal place of business, with PIN code"
              />
            </div>
            <div className="flex items-center gap-4 sm:col-span-2">
              <SubmitButton>{reg ? 'Save GST details' : 'Turn on GST invoices'}</SubmitButton>
            </div>
          </ActionForm>
        ) : null}
        {canEdit && reg ? (
          <form action={removeGstAction.bind(null, storeId)} className="mt-3">
            <button type="submit" className="text-xs text-red-600 hover:underline">
              Remove GST registration (invoices already issued are kept)
            </button>
          </form>
        ) : null}
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Add a tax rate for India (IN) below, usually 18%. Products taxed at another slab (5%, 12%,
          28%) take their own rate from the product page, along with their HSN code.
        </p>
      </Card>
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
