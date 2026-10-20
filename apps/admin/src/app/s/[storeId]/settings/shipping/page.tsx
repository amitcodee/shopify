import { formatMoney, type ShippingZone } from '@repo/contracts';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { Alert, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../confirm-button';
import {
  addRateAction,
  createZoneAction,
  deleteRateAction,
  deleteZoneAction,
} from '../commerce-actions';

export default async function ShippingPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, zones] = await Promise.all([
    getStore(storeId),
    api<ShippingZone[]>(`/admin/stores/${storeId}/shipping-zones`),
  ]);
  const canEdit = store.permissions.includes('settings:write');
  const money = (n: number) => formatMoney(n, store.currency);

  const conditions = (r: ShippingZone['rates'][number]) =>
    [
      r.minSubtotal !== null ? `orders ≥ ${money(r.minSubtotal)}` : null,
      r.maxSubtotal !== null ? `orders ≤ ${money(r.maxSubtotal)}` : null,
      r.minWeightGrams !== null ? `≥ ${r.minWeightGrams} g` : null,
      r.maxWeightGrams !== null ? `≤ ${r.maxWeightGrams} g` : null,
    ]
      .filter(Boolean)
      .join(', ');

  return (
    <div className="space-y-6">
      {zones.length === 0 ? (
        <Alert tone="info">
          No shipping zones yet: customers currently get free standard shipping everywhere.
        </Alert>
      ) : null}
      {zones.map((zone) => (
        <Card
          key={zone.id}
          title={zone.name}
          description={zone.countries.includes('*') ? 'Rest of world' : zone.countries.join(', ')}
          actions={
            canEdit ? (
              <ConfirmButton
                action={deleteZoneAction.bind(null, storeId, zone.id)}
                label="Delete zone"
                confirmLabel="Delete"
              />
            ) : null
          }
        >
          {zone.rates.length === 0 ? (
            <p className="text-sm text-slate-500">
              No rates — customers in this zone cannot check out.
            </p>
          ) : null}
          <ul className="divide-y divide-slate-100">
            {zone.rates.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-medium">{r.name}</span> ·{' '}
                  {r.price === 0 ? 'Free' : money(r.price)}
                  {conditions(r) ? (
                    <span className="text-slate-500"> ({conditions(r)})</span>
                  ) : null}
                </span>
                {canEdit ? (
                  <form action={deleteRateAction.bind(null, storeId, r.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-indigo-600">
                Add rate
              </summary>
              <ActionForm
                action={addRateAction.bind(null, storeId, zone.id, store.currency)}
                className="mt-3 grid gap-3 sm:grid-cols-3"
              >
                <Field name="name" label="Name" required placeholder="Standard" />
                <Field
                  name="price"
                  label={`Price (${store.currency})`}
                  required
                  inputMode="decimal"
                  placeholder="0.00"
                />
                <div />
                <Field name="minSubtotal" label="Min order (optional)" inputMode="decimal" />
                <Field name="maxSubtotal" label="Max order (optional)" inputMode="decimal" />
                <div />
                <Field name="minWeightGrams" label="Min weight g (optional)" inputMode="numeric" />
                <Field name="maxWeightGrams" label="Max weight g (optional)" inputMode="numeric" />
                <div className="sm:col-span-3">
                  <SubmitButton variant="secondary">Add rate</SubmitButton>
                </div>
              </ActionForm>
            </details>
          ) : null}
        </Card>
      ))}
      {canEdit ? (
        <Card
          title="Create shipping zone"
          description="Group countries that share rates. Use * for the rest of the world."
        >
          <ActionForm
            action={createZoneAction.bind(null, storeId)}
            className="grid max-w-xl gap-3 sm:grid-cols-2"
          >
            <Field name="name" label="Zone name" required placeholder="Domestic" />
            <Field
              name="countries"
              label="Countries"
              required
              placeholder="US, CA"
              hint="2-letter codes, comma separated"
            />
            <div className="sm:col-span-2">
              <SubmitButton>Create zone</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      ) : null}
    </div>
  );
}
