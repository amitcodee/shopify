import { type PresentmentCurrency, SUPPORTED_CURRENCIES } from '@repo/contracts';
import { ActionForm, InlineInput, InlineSelect, SubmitButton } from '@/components/form';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { saveCurrenciesAction } from './actions';

const ROUNDINGS = [
  { value: 'EXACT', label: 'Exact (e.g. 18.39)' },
  { value: 'WHOLE', label: 'Whole units (19.00)' },
  { value: 'NINETY_NINE', label: 'Charm (18.99)' },
];

export default async function CurrenciesPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, enabled] = await Promise.all([
    getStore(storeId),
    api<PresentmentCurrency[]>(`/admin/stores/${storeId}/currencies`),
  ]);
  const canWrite = store.permissions.includes('settings:write');
  const byCode = new Map(enabled.map((c) => [c.currency, c]));
  return (
    <Card
      title="Selling in other currencies"
      description={`Shoppers can switch currency on your storefront and pay in it. Prices convert from ${store.currency} at your rates; reports stay in ${store.currency}.`}
    >
      <ActionForm action={saveCurrenciesAction.bind(null, storeId)} className="space-y-4">
        <fieldset disabled={!canWrite} className="space-y-2">
          <legend className="sr-only">Currencies</legend>
          <div className="hidden grid-cols-[8rem_1fr_1fr] gap-3 text-xs font-medium text-slate-500 sm:grid">
            <span>Currency</span>
            <span>{`Rate (per 1 ${store.currency})`}</span>
            <span>Price rounding</span>
          </div>
          {SUPPORTED_CURRENCIES.filter((c) => c !== store.currency).map((code) => {
            const current = byCode.get(code);
            return (
              <div key={code} className="grid items-center gap-3 sm:grid-cols-[8rem_1fr_1fr]">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`enabled-${code}`}
                    defaultChecked={Boolean(current)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {code}
                </label>
                <InlineInput
                  name={`rate-${code}`}
                  label={`Exchange rate for ${code}`}
                  inputMode="decimal"
                  defaultValue={current?.rate}
                  placeholder="e.g. 0.92"
                />
                <InlineSelect
                  name={`rounding-${code}`}
                  label={`Rounding for ${code}`}
                  defaultValue={current?.rounding ?? 'EXACT'}
                  groups={[{ options: ROUNDINGS }]}
                />
              </div>
            );
          })}
        </fieldset>
        <p className="text-xs text-slate-500">
          Rounding applies to product prices; shipping and discounts convert exactly. Gift cards and
          draft orders use {store.currency}. Currencies your payment gateway cannot charge are
          refused.
        </p>
        {canWrite ? <SubmitButton>Save currencies</SubmitButton> : null}
      </ActionForm>
    </Card>
  );
}
