import {
  type DraftOrder,
  formatMoney,
  type InventoryItem,
  minorToDecimalString,
} from '@repo/contracts';
import {
  ActionForm,
  Field,
  InlineInput,
  InlineSelect,
  SelectField,
  SubmitButton,
  TextAreaField,
} from '@/components/form';
import { Card } from '@/components/ui';
import type { FormState } from '@/lib/form';

/** Empty rows offered below the draft's items. */
export const SPARE_ROWS = 3;

export function draftRows(draft: DraftOrder | null): number {
  return Math.min(100, (draft?.lines.length ?? 0) + SPARE_ROWS);
}

export function DraftForm({
  draft,
  variants,
  currency,
  action,
  canWrite,
}: {
  draft: DraftOrder | null;
  variants: InventoryItem[];
  currency: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  canWrite: boolean;
}) {
  const rows = draftRows(draft);
  const itemGroups = [
    {
      options: [
        { value: '', label: '— No item —' },
        { value: 'custom', label: 'Custom item…' },
      ],
    },
    {
      label: 'Products',
      options: variants.map((v) => ({
        value: `variant:${v.variantId}`,
        label: `${v.productTitle}${v.variantTitle !== 'Default' ? ` — ${v.variantTitle}` : ''}${
          v.trackInventory ? ` (${v.inventoryQuantity} in stock)` : ''
        }`,
      })),
    },
  ];
  const a = draft?.shippingAddress;
  const money = (amount: number | undefined) =>
    amount === undefined ? '' : minorToDecimalString(amount, currency);

  return (
    <ActionForm action={action} className="space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <Card title="Items" description="Leave the price empty to use the catalog price.">
          <div className="space-y-2">
            <div className="hidden grid-cols-[2fr_1.2fr_5rem_7rem_5rem] gap-2 text-xs font-medium text-slate-500 md:grid">
              <span>Item</span>
              <span>Custom item name</span>
              <span>Qty</span>
              <span>Price ({currency})</span>
              <span>Ships</span>
            </div>
            {Array.from({ length: rows }, (_, i) => {
              const line = draft?.lines[i];
              const item = line ? (line.variantId ? `variant:${line.variantId}` : 'custom') : '';
              return (
                <div key={i} className="grid gap-2 md:grid-cols-[2fr_1.2fr_5rem_7rem_5rem]">
                  <InlineSelect
                    name={`item-${i}`}
                    label={`Item ${i + 1}`}
                    defaultValue={item}
                    groups={itemGroups}
                  />
                  <InlineInput
                    name={`title-${i}`}
                    label={`Custom item name ${i + 1}`}
                    defaultValue={line && !line.variantId ? line.title : ''}
                    maxLength={200}
                  />
                  <InlineInput
                    name={`qty-${i}`}
                    label={`Quantity ${i + 1}`}
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={line?.quantity ?? 1}
                  />
                  <InlineInput
                    name={`price-${i}`}
                    label={`Price ${i + 1}`}
                    inputMode="decimal"
                    defaultValue={money(line?.unitPrice)}
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      name={`ship-${i}`}
                      defaultChecked={line?.requiresShipping ?? true}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="sr-only">Item {i + 1} </span>ships
                  </label>
                </div>
              );
            })}
            <p className="text-xs text-slate-500">
              “Ships” applies to custom items; catalog items use the product setting. Save to add
              more rows.
            </p>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Customer">
            <div className="space-y-4">
              <Field
                name="email"
                label="Email"
                type="email"
                defaultValue={draft?.email}
                hint="Required to send an invoice or complete the order."
              />
              <Field name="shippingAddress.name" label="Name" defaultValue={a?.name} />
              <Field name="shippingAddress.line1" label="Address" defaultValue={a?.line1} />
              <Field
                name="shippingAddress.line2"
                label="Apartment, suite"
                defaultValue={a?.line2}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field name="shippingAddress.city" label="City" defaultValue={a?.city} />
                <Field
                  name="shippingAddress.region"
                  label="State / region"
                  defaultValue={a?.region}
                />
                <Field
                  name="shippingAddress.postalCode"
                  label="Postal code"
                  defaultValue={a?.postalCode}
                />
                <Field
                  name="shippingAddress.country"
                  label="Country (2 letters)"
                  defaultValue={a?.country}
                  maxLength={2}
                />
              </div>
            </div>
          </Card>
          <Card title="Shipping, discount and notes">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  name="shipping.title"
                  label="Shipping method"
                  defaultValue={draft?.shipping?.title}
                  hint="Leave empty for no shipping charge."
                />
                <Field
                  name="shipping.price"
                  label={`Shipping price (${currency})`}
                  inputMode="decimal"
                  defaultValue={money(draft?.shipping?.price)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  name="discount.type"
                  label="Discount"
                  defaultValue={draft?.discount?.type ?? 'none'}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'PERCENTAGE', label: 'Percentage' },
                    { value: 'FIXED_AMOUNT', label: 'Fixed amount' },
                  ]}
                />
                <Field
                  name="discount.value"
                  label="Discount value"
                  inputMode="decimal"
                  defaultValue={
                    draft?.discount
                      ? draft.discount.type === 'PERCENTAGE'
                        ? String(draft.discount.value)
                        : money(draft.discount.value)
                      : ''
                  }
                  hint="Percent (e.g. 10) or an amount."
                />
              </div>
              <TextAreaField name="note" label="Note" defaultValue={draft?.note ?? ''} rows={3} />
            </div>
          </Card>
        </div>
      </fieldset>
      {canWrite ? <SubmitButton>{draft ? 'Save draft' : 'Create draft'}</SubmitButton> : null}
    </ActionForm>
  );
}

export function DraftSummary({ draft }: { draft: DraftOrder }) {
  const f = (amount: number) => formatMoney(amount, draft.currency);
  const rows: [string, number][] = [
    ['Subtotal', draft.subtotal],
    ...(draft.discountTotal ? ([['Discount', -draft.discountTotal]] as [string, number][]) : []),
    ['Shipping', draft.shippingTotal],
    ['Tax', draft.taxTotal],
  ];
  return (
    <dl className="space-y-1 text-sm">
      {rows.map(([label, amount]) => (
        <div key={label} className="flex justify-between text-slate-600">
          <dt>{label}</dt>
          <dd>{f(amount)}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
        <dt>Total</dt>
        <dd>{f(draft.total)}</dd>
      </div>
    </dl>
  );
}
