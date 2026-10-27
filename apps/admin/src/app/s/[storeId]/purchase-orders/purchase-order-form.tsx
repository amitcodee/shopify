'use client';

import {
  formatMoney,
  type Location,
  MAX_PURCHASE_ORDER_LINES,
  minorToDecimalString,
  parseMoney,
  type PurchaseOrder,
  type ReorderSuggestion,
  type Supplier,
} from '@repo/contracts';
import { type FormEvent, useActionState, useMemo, useState, useTransition } from 'react';
import { Icon } from '@/components/icons';
import { Alert, buttonClass, Card, EmptyState, inputClass } from '@/components/ui';
import type { FormState } from '@/lib/form';
import type { VariantPick } from '../products/actions';
import { VariantPicker } from '../products/product-editor-extras';

interface LineRow {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  quantity: string;
  unitCost: string;
  supplierSku: string;
}

const input = `${inputClass} w-full py-2`;
const cellInput = `${inputClass} h-8`;
const label = 'block text-[13px] font-medium text-slate-800';
const hint = 'text-xs leading-5 text-slate-500';

function addDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function itemName(l: { productTitle: string; variantTitle: string }) {
  return l.variantTitle === 'Default' ? l.productTitle : `${l.productTitle} — ${l.variantTitle}`;
}

export function PurchaseOrderForm({
  order,
  suppliers,
  locations,
  currency,
  action,
  search,
  reorder,
  initialSupplierId,
}: {
  order: PurchaseOrder | null;
  suppliers: Supplier[];
  locations: Location[];
  currency: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  search: (query: string) => Promise<VariantPick[]>;
  reorder: (supplierId: string) => Promise<ReorderSuggestion[]>;
  initialSupplierId?: string;
}) {
  const [state, formAction, saving] = useActionState(action, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const activeLocations = locations.filter((l) => l.active);
  const [supplierId, setSupplierId] = useState(
    order?.supplier.id ?? initialSupplierId ?? suppliers.find((s) => s.active)?.id ?? '',
  );
  const [locationId, setLocationId] = useState(
    order?.location.id ??
      activeLocations.find((l) => l.isDefault)?.id ??
      activeLocations[0]?.id ??
      '',
  );
  // A new order expects delivery after the preselected supplier's usual lead time.
  const [expectedAt, setExpectedAt] = useState(() => {
    if (order) return order.expectedAt ?? '';
    const lead = suppliers.find((s) => s.id === supplierId)?.leadTimeDays;
    return lead == null ? '' : addDays(lead);
  });
  const [supplierReference, setSupplierReference] = useState(order?.supplierReference ?? '');
  const [shippingCost, setShippingCost] = useState(
    order?.shippingCost ? minorToDecimalString(order.shippingCost, currency) : '',
  );
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [lines, setLines] = useState<LineRow[]>(
    order?.lines.flatMap((l) =>
      l.variantId
        ? [
            {
              variantId: l.variantId,
              productTitle: l.productTitle,
              variantTitle: l.variantTitle,
              sku: l.sku,
              quantity: String(l.quantity),
              unitCost: minorToDecimalString(l.unitCost, currency),
              supplierSku: l.supplierSku,
            },
          ]
        : [],
    ) ?? [],
  );
  const [picking, setPicking] = useState(false);
  const [loadingSuggestions, startSuggestions] = useTransition();

  const supplier = suppliers.find((s) => s.id === supplierId);
  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => {
      const cost = parseMoney(l.unitCost || '0', currency) ?? 0;
      return sum + cost * (Number.parseInt(l.quantity || '0', 10) || 0);
    }, 0);
    const shipping = parseMoney(shippingCost || '0', currency) ?? 0;
    return {
      subtotal,
      shipping,
      total: subtotal + shipping,
      units: lines.reduce((s, l) => s + (Number.parseInt(l.quantity || '0', 10) || 0), 0),
    };
  }, [lines, shippingCost, currency]);

  const payload = {
    supplierId,
    locationId,
    expectedAt: expectedAt || null,
    supplierReference,
    shippingCost: parseMoney(shippingCost || '0', currency),
    notes,
    lines: lines.map((l) => ({
      variantId: l.variantId,
      quantity: Number.parseInt(l.quantity || '0', 10),
      unitCost: parseMoney(l.unitCost || '0', currency),
      supplierSku: l.supplierSku,
    })),
  };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    let error: string | null = null;
    if (!supplierId) error = 'Choose a supplier.';
    else if (!locationId) error = 'Choose where the stock will arrive.';
    else if (lines.length === 0) error = 'Add at least one item.';
    else if (payload.lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1))
      error = 'Every item needs a quantity of at least 1.';
    else if (payload.lines.some((l) => l.unitCost === null))
      error = 'Enter a valid unit cost for every item (e.g. 4.50).';
    else if (payload.shippingCost === null) error = 'Enter a valid shipping cost.';
    setClientError(error);
    if (error) event.preventDefault();
  }

  function chooseSupplier(id: string) {
    setSupplierId(id);
    const next = suppliers.find((s) => s.id === id);
    if (!expectedAt && next?.leadTimeDays != null) setExpectedAt(addDays(next.leadTimeDays));
  }

  function addLowStock() {
    if (!supplierId) return;
    startSuggestions(async () => {
      try {
        const suggestions = await reorder(supplierId);
        const present = new Set(lines.map((l) => l.variantId));
        const fresh = suggestions.filter((s) => !present.has(s.variantId));
        setLines((prev) =>
          [
            ...prev,
            ...fresh.map((s) => ({
              variantId: s.variantId,
              productTitle: s.productTitle,
              variantTitle: s.variantTitle,
              sku: s.sku,
              quantity: String(s.suggestedQuantity),
              unitCost: s.costPerItem == null ? '' : minorToDecimalString(s.costPerItem, currency),
              supplierSku: '',
            })),
          ].slice(0, MAX_PURCHASE_ORDER_LINES),
        );
        setNotice(
          fresh.length === 0
            ? `Nothing from ${supplier?.name ?? 'this supplier'} is low on stock.`
            : `Added ${fresh.length} low-stock ${fresh.length === 1 ? 'item' : 'items'}, topped up to 20 units each.`,
        );
      } catch {
        setNotice('Could not load low-stock items. Try again.');
      }
    });
  }

  const patch = (variantId: string, change: Partial<LineRow>) =>
    setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...change } : l)));
  const errorList = Object.entries(state?.fieldErrors ?? {});

  if (suppliers.length === 0) {
    return (
      <EmptyState
        icon="truck"
        title="Add a supplier first"
        description="Purchase orders are sent to a supplier. Add the companies you buy from, then come back."
      />
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {clientError ? <Alert tone="error">{clientError}</Alert> : null}
      {state?.error ? (
        <Alert tone="error">
          {state.error}
          {errorList.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {errorList.map(([path, message]) => (
                <li key={path}>
                  <code>{path}</code>: {message}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card title="Supplier and destination">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="po-supplier" className={label}>
                  Supplier
                </label>
                <select
                  id="po-supplier"
                  className={input}
                  value={supplierId}
                  onChange={(e) => chooseSupplier(e.target.value)}
                >
                  {suppliers
                    .filter((s) => s.active || s.id === supplierId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                {supplier?.email ? <p className={hint}>{supplier.email}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="po-location" className={label}>
                  Destination
                </label>
                <select
                  id="po-location"
                  className={input}
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  {activeLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <p className={hint}>Received stock is added to this location.</p>
              </div>
            </div>
          </Card>

          <Card
            title="Items"
            flush
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass('secondary', 'sm')}
                  disabled={!supplierId || loadingSuggestions}
                  onClick={addLowStock}
                  title="Adds this supplier's products at or below 5 units"
                >
                  <Icon name="sparkles" className="-ml-0.5 h-4 w-4" />
                  {loadingSuggestions ? 'Finding…' : 'Add low-stock items'}
                </button>
                <button
                  type="button"
                  className={buttonClass('secondary', 'sm')}
                  disabled={lines.length >= MAX_PURCHASE_ORDER_LINES}
                  onClick={() => setPicking(true)}
                >
                  <Icon name="plus" className="-ml-0.5 h-4 w-4" strokeWidth={2} />
                  Add item
                </button>
              </div>
            }
          >
            {notice ? (
              <div className="border-b border-slate-100 px-5 py-3">
                <Alert tone="info">{notice}</Alert>
              </div>
            ) : null}
            {lines.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No items yet. Add products, or let us fill in this supplier&apos;s low-stock items.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm [&_td]:py-2 [&_td]:pr-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-medium whitespace-nowrap text-slate-500 [&_th]:py-2.5 [&_th]:pr-3 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
                      <th>Item</th>
                      <th>Supplier SKU</th>
                      <th>Quantity</th>
                      <th>Unit cost</th>
                      <th className="text-right">Total</th>
                      <th>
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l) => {
                      const name = itemName(l);
                      const cost = parseMoney(l.unitCost || '0', currency);
                      const qty = Number.parseInt(l.quantity || '0', 10) || 0;
                      return (
                        <tr key={l.variantId}>
                          <td className="min-w-48">
                            <p className="font-medium text-slate-900">{name}</p>
                            <p className="text-xs text-slate-500">{l.sku ?? 'No SKU'}</p>
                          </td>
                          <td>
                            <input
                              aria-label={`Supplier SKU for ${name}`}
                              className={`${cellInput} w-28`}
                              maxLength={64}
                              value={l.supplierSku}
                              onChange={(e) => patch(l.variantId, { supplierSku: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Quantity of ${name}`}
                              className={`${cellInput} w-20`}
                              inputMode="numeric"
                              value={l.quantity}
                              onChange={(e) =>
                                patch(l.variantId, { quantity: e.target.value.replace(/\D/g, '') })
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Unit cost of ${name}`}
                              className={`${cellInput} w-24 aria-[invalid=true]:border-red-500`}
                              inputMode="decimal"
                              placeholder="0.00"
                              aria-invalid={cost === null || undefined}
                              value={l.unitCost}
                              onChange={(e) => patch(l.variantId, { unitCost: e.target.value })}
                            />
                          </td>
                          <td className="text-right whitespace-nowrap text-slate-900 tabular-nums">
                            {cost === null ? '—' : formatMoney(cost * qty, currency)}
                          </td>
                          <td>
                            <button
                              type="button"
                              aria-label={`Remove ${name}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              onClick={() =>
                                setLines((prev) => prev.filter((x) => x.variantId !== l.variantId))
                              }
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Notes">
            <label htmlFor="po-notes" className="sr-only">
              Notes
            </label>
            <textarea
              id="po-notes"
              className={input}
              rows={3}
              maxLength={2000}
              placeholder="Delivery instructions, payment terms…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Details">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="po-expected" className={label}>
                  Expected arrival
                </label>
                <input
                  id="po-expected"
                  type="date"
                  className={input}
                  value={expectedAt}
                  onChange={(e) => setExpectedAt(e.target.value)}
                />
                {supplier?.leadTimeDays != null ? (
                  <p className={hint}>
                    {supplier.name} usually delivers in {supplier.leadTimeDays}{' '}
                    {supplier.leadTimeDays === 1 ? 'day' : 'days'}.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="po-reference" className={label}>
                  Supplier reference
                </label>
                <input
                  id="po-reference"
                  className={input}
                  maxLength={100}
                  placeholder="Their order or invoice number"
                  value={supplierReference}
                  onChange={(e) => setSupplierReference(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="po-shipping" className={label}>
                  Shipping cost ({currency})
                </label>
                <input
                  id="po-shipping"
                  className={input}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                />
              </div>
            </div>
          </Card>
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Items</dt>
                <dd className="tabular-nums">
                  {lines.length} · {totals.units} {totals.units === 1 ? 'unit' : 'units'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(totals.subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Shipping</dt>
                <dd className="tabular-nums">{formatMoney(totals.shipping, currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(totals.total, currency)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-raised backdrop-blur">
        <p className="mr-auto hidden text-[13px] text-slate-500 sm:block">
          Saved as a draft. Mark it as ordered once you have sent it to the supplier.
        </p>
        <button type="submit" className={buttonClass('primary')} disabled={saving}>
          {saving ? 'Saving…' : order ? 'Save draft' : 'Create draft'}
        </button>
      </div>

      {picking ? (
        <VariantPicker
          title="Add item"
          exclude={new Set(lines.map((l) => l.variantId))}
          currency={currency}
          search={search}
          onClose={() => setPicking(false)}
          onPick={(pick) => {
            setLines((prev) => [
              ...prev,
              {
                variantId: pick.variantId,
                productTitle: pick.productTitle,
                variantTitle: pick.variantTitle,
                sku: pick.sku,
                quantity: '1',
                unitCost:
                  pick.costPerItem == null ? '' : minorToDecimalString(pick.costPerItem, currency),
                supplierSku: '',
              },
            ]);
            setPicking(false);
          }}
        />
      ) : null}
    </form>
  );
}
