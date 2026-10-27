'use client';

import {
  type Customization,
  type CustomizationType,
  formatMoney,
  MAX_BUNDLE_COMPONENTS,
  MAX_CUSTOMIZATION_CHOICES,
  MAX_CUSTOMIZATIONS_PER_PRODUCT,
  minorToDecimalString,
  type OptionStyle,
  parseMoney,
} from '@repo/contracts';
import { useEffect, useId, useState, useTransition } from 'react';
import { Dialog } from '@/components/dialog';
import { Icon } from '@/components/icons';
import { Alert, Badge, buttonClass, Card, inputClass } from '@/components/ui';
import type { VariantPick } from './actions';

const input = `${inputClass} w-full py-2`;
const cellInput = `${inputClass} h-8`;
const label = 'block text-[13px] font-medium text-slate-800';
const hint = 'text-xs leading-5 text-slate-500';

let nextUid = 1;

// ── Option display style ──────────────────────────────────────────────────────

export const OPTION_STYLES: { value: OptionStyle; label: string }[] = [
  { value: 'buttons', label: 'Buttons' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'swatches', label: 'Colour swatches' },
];

/** Colour pickers for each value of an option shown as swatches. */
export function SwatchEditor({
  optionName,
  values,
  swatches,
  onChange,
}: {
  optionName: string;
  values: string[];
  swatches: Record<string, string>;
  onChange: (value: string, color: string) => void;
}) {
  if (values.length === 0) {
    return <p className={hint}>Add values to pick their colours.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => {
        const color = swatches[value] ?? '';
        return (
          <li
            key={value}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pr-1 pl-2"
          >
            <span
              aria-hidden
              className="h-5 w-5 rounded-full ring-1 ring-slate-900/15"
              style={{
                background:
                  color || 'repeating-conic-gradient(#e2e8f0 0% 25%, #fff 0% 50%) 50% / 8px 8px',
              }}
            />
            <span className="text-[13px] text-slate-700">{value}</span>
            <input
              type="color"
              aria-label={`Swatch colour for ${optionName} ${value}`}
              value={color || '#cccccc'}
              onChange={(e) => onChange(value, e.target.value)}
              className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            {color ? (
              <button
                type="button"
                aria-label={`Clear swatch colour for ${value}`}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => onChange(value, '')}
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// ── Bulk edit ─────────────────────────────────────────────────────────────────

export type BulkField = 'price' | 'compareAtPrice' | 'costPerItem' | 'inventoryQuantity';

/**
 * Applies one value to many variants at once: all of them, or those with one option value
 * ("Colour: Red"). SKUs can be generated from a prefix and the option values.
 */
export function VariantBulkEdit({
  options,
  allowStock,
  onApply,
  onGenerateSkus,
}: {
  options: { name: string; values: string[] }[];
  /** Starting stock can only be set before variants are saved. */
  allowStock: boolean;
  onApply: (
    target: { position: number; value: string } | null,
    field: BulkField,
    value: string,
  ) => void;
  onGenerateSkus: (prefix: string) => void;
}) {
  const id = useId();
  const [target, setTarget] = useState('all');
  const [field, setField] = useState<BulkField>('price');
  const [value, setValue] = useState('');
  const [prefix, setPrefix] = useState('');
  const fields: { value: BulkField; label: string }[] = [
    { value: 'price', label: 'Price' },
    { value: 'compareAtPrice', label: 'Compare-at price' },
    { value: 'costPerItem', label: 'Cost per item' },
    ...(allowStock ? [{ value: 'inventoryQuantity' as const, label: 'Starting stock' }] : []),
  ];
  const parsedTarget = () => {
    if (target === 'all') return null;
    const [position, ...rest] = target.split(':');
    return { position: Number(position), value: rest.join(':') };
  };
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-target`} className="block text-xs font-medium text-slate-600">
            Edit
          </label>
          <select
            id={`${id}-target`}
            className={`${cellInput} py-0`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="all">All variants</option>
            {options.map((o, position) => (
              <optgroup key={o.name} label={o.name}>
                {o.values.map((v) => (
                  <option key={v} value={`${position}:${v}`}>
                    {o.name}: {v}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-field`} className="block text-xs font-medium text-slate-600">
            Field
          </label>
          <select
            id={`${id}-field`}
            className={`${cellInput} py-0`}
            value={field}
            onChange={(e) => setField(e.target.value as BulkField)}
          >
            {fields.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-value`} className="block text-xs font-medium text-slate-600">
            Value
          </label>
          <input
            id={`${id}-value`}
            className={`${cellInput} w-28`}
            inputMode={field === 'inventoryQuantity' ? 'numeric' : 'decimal'}
            placeholder={field === 'inventoryQuantity' ? '0' : '0.00'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={buttonClass('secondary', 'sm')}
          onClick={() => onApply(parsedTarget(), field, value.trim())}
        >
          Apply
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-prefix`} className="block text-xs font-medium text-slate-600">
            SKU prefix
          </label>
          <input
            id={`${id}-prefix`}
            className={`${cellInput} w-28 uppercase`}
            placeholder="TEE"
            maxLength={30}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
          />
        </div>
        <button
          type="button"
          className={buttonClass('secondary', 'sm')}
          disabled={!prefix}
          onClick={() => onGenerateSkus(prefix)}
          title="Fills every variant's SKU, e.g. TEE-RED-M"
        >
          Generate SKUs
        </button>
      </div>
    </div>
  );
}

/** "Red", "Extra large" -> "RED", "EXTRA-LARGE" (for generated SKUs). */
export function skuPart(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 12) || 'X'
  );
}

// ── Bundle contents ───────────────────────────────────────────────────────────

export interface ComponentRow {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  price: number;
  inventoryQuantity: number;
  trackInventory: boolean;
  quantity: number;
}

function itemName(c: { productTitle: string; variantTitle: string }) {
  return c.variantTitle === 'Default' ? c.productTitle : `${c.productTitle} — ${c.variantTitle}`;
}

/** How many complete bundles the items make (null when no tracked item limits it). */
export function bundlesAvailable(rows: ComponentRow[]): number | null {
  const tracked = rows.filter((r) => r.trackInventory);
  if (tracked.length === 0) return null;
  return Math.min(...tracked.map((r) => Math.floor(Math.max(0, r.inventoryQuantity) / r.quantity)));
}

export function BundleContentsCard({
  variants,
  currency,
  onChange,
  search,
  disabled,
}: {
  /** One entry per bundle variant: its name, price (minor units or null) and items. */
  variants: { key: string; name: string; price: number | null; rows: ComponentRow[] }[];
  currency: string;
  onChange: (key: string, rows: ComponentRow[]) => void;
  search: (query: string) => Promise<VariantPick[]>;
  disabled: boolean;
}) {
  const [picking, setPicking] = useState<string | null>(null);
  const pickingVariant = variants.find((v) => v.key === picking);
  return (
    <Card
      title="Bundle contents"
      description="What one unit of each variant contains. Stock is taken from these products when the bundle sells, so the bundle is only available while every item is."
    >
      <div className="space-y-4">
        {variants.map((variant) => {
          const value = variant.rows.reduce((s, r) => s + r.price * r.quantity, 0);
          const available = bundlesAvailable(variant.rows);
          const saving =
            variant.price !== null && value > variant.price ? value - variant.price : 0;
          return (
            <section key={variant.key} className="rounded-lg border border-slate-200">
              {variants.length > 1 ? (
                <h3 className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[13px] font-semibold text-slate-900">
                  {variant.name}
                </h3>
              ) : null}
              {variant.rows.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">
                  No items yet. Add the products that go into this bundle.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {variant.rows.map((row) => (
                    <li
                      key={row.variantId}
                      className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {itemName(row)}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {formatMoney(row.price, currency)} each
                          {row.sku ? ` · ${row.sku}` : ''}
                          {row.trackInventory
                            ? ` · ${row.inventoryQuantity} in stock`
                            : ' · not tracked'}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-[13px] text-slate-600">
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className={`${cellInput} w-16`}
                          value={row.quantity}
                          onChange={(e) => {
                            const quantity = Math.min(
                              100,
                              Math.max(1, Number(e.target.value) || 1),
                            );
                            onChange(
                              variant.key,
                              variant.rows.map((r) =>
                                r.variantId === row.variantId ? { ...r, quantity } : r,
                              ),
                            );
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove ${itemName(row)}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() =>
                          onChange(
                            variant.key,
                            variant.rows.filter((r) => r.variantId !== row.variantId),
                          )
                        }
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5">
                <p className="text-xs text-slate-500 tabular-nums">
                  Items worth {formatMoney(value, currency)}
                  {saving > 0 ? (
                    <>
                      {' · '}
                      <span className="font-medium text-emerald-700">
                        shoppers save {formatMoney(saving, currency)}
                      </span>
                    </>
                  ) : null}
                  {' · '}
                  {available === null ? 'stock not limited' : `${available} can be sold`}
                </p>
                <button
                  type="button"
                  className={buttonClass('secondary', 'sm')}
                  disabled={disabled || variant.rows.length >= MAX_BUNDLE_COMPONENTS}
                  onClick={() => setPicking(variant.key)}
                >
                  <Icon name="plus" className="-ml-0.5 h-4 w-4" strokeWidth={2} />
                  Add item
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {pickingVariant ? (
        <VariantPicker
          title={`Add to ${variants.length > 1 ? pickingVariant.name : 'the bundle'}`}
          exclude={new Set(pickingVariant.rows.map((r) => r.variantId))}
          currency={currency}
          search={search}
          onClose={() => setPicking(null)}
          onPick={(pick) => {
            onChange(pickingVariant.key, [...pickingVariant.rows, { ...pick, quantity: 1 }]);
            setPicking(null);
          }}
        />
      ) : null}
    </Card>
  );
}

/** Search dialog listing the store's variants (bundles are never offered). */
export function VariantPicker({
  title,
  exclude,
  currency,
  search,
  onPick,
  onClose,
}: {
  title: string;
  exclude: Set<string>;
  currency: string;
  search: (query: string) => Promise<VariantPick[]>;
  onPick: (pick: VariantPick) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VariantPick[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          setResults(await search(query));
          setError(null);
        } catch {
          setError('Could not search products. Try again.');
        }
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  const shown = (results ?? []).filter((r) => !exclude.has(r.variantId));
  return (
    <Dialog title={title} description="Search by product title or SKU." size="lg" onClose={onClose}>
      <input
        autoFocus
        type="search"
        aria-label="Search products"
        className={input}
        placeholder="Search products"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {results === null || (pending && shown.length === 0) ? (
          <li className="px-4 py-6 text-center text-sm text-slate-500">Searching…</li>
        ) : shown.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-slate-500">No matching products.</li>
        ) : (
          shown.map((r) => (
            <li key={r.variantId}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {itemName(r)}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {r.sku ?? 'No SKU'} ·{' '}
                    {r.trackInventory ? `${r.inventoryQuantity} in stock` : 'not tracked'}
                  </span>
                </span>
                <span className="text-sm text-slate-700 tabular-nums">
                  {formatMoney(r.price, currency)}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Dialog>
  );
}

// ── Personalisation (shopper customizations) ──────────────────────────────────

export interface CustomizationRow {
  uid: number;
  id?: string;
  type: CustomizationType;
  label: string;
  required: boolean;
  helpText: string;
  price: string;
  maxLength: string;
  choices: { uid: number; label: string; price: string }[];
}

const TYPES: { value: CustomizationType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'A short line, e.g. engraving or initials' },
  { value: 'textarea', label: 'Paragraph', hint: 'A longer message, e.g. a gift note' },
  { value: 'select', label: 'Dropdown', hint: 'Pick one choice, each with its own price' },
  { value: 'checkbox', label: 'Checkbox', hint: 'An add-on such as gift wrap' },
];

export function customizationRows(fields: Customization[], currency: string): CustomizationRow[] {
  return fields.map((f) => ({
    uid: nextUid++,
    id: f.id,
    type: f.type,
    label: f.label,
    required: f.required,
    helpText: f.helpText,
    price: f.price ? minorToDecimalString(f.price, currency) : '',
    maxLength: String(f.maxLength || 100),
    choices: f.choices.map((c) => ({
      uid: nextUid++,
      label: c.label,
      price: c.price ? minorToDecimalString(c.price, currency) : '',
    })),
  }));
}

/** The API input for the rows, or an error to show before saving. */
export function customizationPayload(
  rows: CustomizationRow[],
  currency: string,
): { value: unknown[] } | { error: string } {
  const money = (text: string) => (text.trim() ? parseMoney(text, currency) : 0);
  const out: unknown[] = [];
  for (const row of rows) {
    const name = row.label.trim() || 'a personalisation field';
    if (!row.label.trim()) return { error: 'Give every personalisation field a label.' };
    const price = money(row.price);
    if (price === null) return { error: `Enter a valid extra price for ${name}.` };
    const choices = [];
    for (const c of row.choices) {
      const choicePrice = money(c.price);
      if (!c.label.trim()) return { error: `Name every choice of ${name}.` };
      if (choicePrice === null) return { error: `Enter a valid price for "${c.label}".` };
      choices.push({ label: c.label.trim(), price: choicePrice });
    }
    if (row.type === 'select' && choices.length < 2) {
      return { error: `${name} needs at least two choices.` };
    }
    out.push({
      ...(row.id ? { id: row.id } : {}),
      type: row.type,
      label: row.label.trim(),
      required: row.required,
      helpText: row.helpText.trim(),
      price,
      maxLength: Math.min(500, Math.max(1, Number.parseInt(row.maxLength || '100', 10) || 100)),
      choices,
    });
  }
  return { value: out };
}

export function CustomizationsCard({
  rows,
  currency,
  onChange,
}: {
  rows: CustomizationRow[];
  currency: string;
  onChange: (update: (rows: CustomizationRow[]) => CustomizationRow[]) => void;
}) {
  const baseId = useId();
  const full = rows.length >= MAX_CUSTOMIZATIONS_PER_PRODUCT;
  const patch = (uid: number, change: Partial<CustomizationRow>) =>
    onChange((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...change } : r)));
  const move = (uid: number, by: number) =>
    onChange((prev) => {
      const index = prev.findIndex((r) => r.uid === uid);
      const to = index + by;
      if (index < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to]!, next[index]!];
      return next;
    });
  const add = (type: CustomizationType) =>
    onChange((prev) => [
      ...prev,
      {
        uid: nextUid++,
        type,
        label: '',
        required: false,
        helpText: '',
        price: '',
        maxLength: '100',
        choices:
          type === 'select'
            ? [
                { uid: nextUid++, label: '', price: '' },
                { uid: nextUid++, label: '', price: '' },
              ]
            : [],
      },
    ]);

  return (
    <Card
      title="Personalisation"
      description="Ask shoppers for details such as engraving text, a gift note or gift wrap. Each answer can add to the price, and different answers stay separate in the cart."
      actions={<AddFieldMenu disabled={full} onAdd={add} />}
    >
      {rows.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          No personalisation. Shoppers just pick a variant.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const id = `${baseId}-${row.uid}`;
            const type = TYPES.find((t) => t.value === row.type)!;
            return (
              <li key={row.uid} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge tone="indigo">{type.label}</Badge>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${row.label || 'field'} up`}
                      disabled={index === 0}
                      onClick={() => move(row.uid, -1)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Icon name="arrowUp" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${row.label || 'field'} down`}
                      disabled={index === rows.length - 1}
                      onClick={() => move(row.uid, 1)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Icon name="arrowDown" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${row.label || 'field'}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-red-600 hover:bg-red-50"
                      onClick={() => onChange((prev) => prev.filter((r) => r.uid !== row.uid))}
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <div className="space-y-1">
                    <label htmlFor={`${id}-label`} className={label}>
                      Label
                    </label>
                    <input
                      id={`${id}-label`}
                      className={input}
                      maxLength={60}
                      placeholder={
                        row.type === 'checkbox'
                          ? 'Gift wrap'
                          : row.type === 'select'
                            ? 'Font'
                            : row.type === 'textarea'
                              ? 'Gift message'
                              : 'Engraving'
                      }
                      value={row.label}
                      onChange={(e) => patch(row.uid, { label: e.target.value })}
                    />
                  </div>
                  {row.type !== 'select' ? (
                    <div className="space-y-1">
                      <label htmlFor={`${id}-price`} className={label}>
                        Extra price
                      </label>
                      <input
                        id={`${id}-price`}
                        className={input}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.price}
                        onChange={(e) => patch(row.uid, { price: e.target.value })}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 space-y-1">
                  <label htmlFor={`${id}-help`} className={label}>
                    Help text <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id={`${id}-help`}
                    className={input}
                    maxLength={200}
                    placeholder={type.hint}
                    value={row.helpText}
                    onChange={(e) => patch(row.uid, { helpText: e.target.value })}
                  />
                </div>
                {row.type === 'select' ? (
                  <ChoicesEditor
                    row={row}
                    currency={currency}
                    onChange={(choices) => patch(row.uid, { choices })}
                  />
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(e) => patch(row.uid, { required: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {row.type === 'checkbox' ? 'Must be ticked' : 'Required'}
                  </label>
                  {row.type === 'text' || row.type === 'textarea' ? (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      Up to
                      <input
                        type="number"
                        min={1}
                        max={500}
                        aria-label="Maximum characters"
                        className={`${cellInput} w-20`}
                        value={row.maxLength}
                        onChange={(e) => patch(row.uid, { maxLength: e.target.value })}
                      />
                      characters
                    </label>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500 tabular-nums">
        {rows.length} of {MAX_CUSTOMIZATIONS_PER_PRODUCT} fields · prices in {currency}
      </p>
    </Card>
  );
}

function AddFieldMenu({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (type: CustomizationType) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className={buttonClass('secondary', 'sm')}
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="plus" className="-ml-0.5 h-4 w-4" strokeWidth={2} />
        Add personalisation
      </button>
      {open ? (
        <ul className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-raised">
          {TYPES.map((t) => (
            <li key={t.value}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  onAdd(t.value);
                  setOpen(false);
                }}
              >
                <span className="block text-sm font-medium text-slate-900">{t.label}</span>
                <span className="block text-xs text-slate-500">{t.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ChoicesEditor({
  row,
  currency,
  onChange,
}: {
  row: CustomizationRow;
  currency: string;
  onChange: (choices: CustomizationRow['choices']) => void;
}) {
  const update = (uid: number, change: Partial<CustomizationRow['choices'][number]>) =>
    onChange(row.choices.map((c) => (c.uid === uid ? { ...c, ...change } : c)));
  return (
    <fieldset className="mt-3">
      <legend className={label}>Choices</legend>
      <ul className="mt-1.5 space-y-2">
        {row.choices.map((choice, index) => (
          <li key={choice.uid} className="flex items-center gap-2">
            <input
              aria-label={`Choice ${index + 1}`}
              className={`${cellInput} min-w-0 flex-1`}
              maxLength={60}
              placeholder={index === 0 ? 'Classic' : 'Script'}
              value={choice.label}
              onChange={(e) => update(choice.uid, { label: e.target.value })}
            />
            <input
              aria-label={`Extra price for choice ${index + 1} (${currency})`}
              className={`${cellInput} w-24`}
              inputMode="decimal"
              placeholder="+0.00"
              value={choice.price}
              onChange={(e) => update(choice.uid, { price: e.target.value })}
            />
            <button
              type="button"
              aria-label={`Remove choice ${index + 1}`}
              disabled={row.choices.length <= 2}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              onClick={() => onChange(row.choices.filter((c) => c.uid !== choice.uid))}
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-2 text-[13px] font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
        disabled={row.choices.length >= MAX_CUSTOMIZATION_CHOICES}
        onClick={() => onChange([...row.choices, { uid: nextUid++, label: '', price: '' }])}
      >
        + Add choice
      </button>
    </fieldset>
  );
}
