'use client';

import {
  formatMoney,
  MAX_METAFIELDS_PER_PRODUCT,
  type MetafieldType,
  minorToDecimalString,
  normalizeMetafieldValue,
  parseMoney,
  type Product,
  type ProductImage,
  slugify,
} from '@repo/contracts';
import {
  type FormEvent,
  type ReactNode,
  useActionState,
  useId,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from 'react';
import { Dialog } from '@/components/dialog';
import { Icon } from '@/components/icons';
import { Alert, Badge, buttonClass, Card, formatDateTime, inputClass } from '@/components/ui';
import { useCountryOptions, useHydrated } from '@/lib/countries';
import type { FormState } from '@/lib/form';
import type { ActionResult } from './actions';
import { imageSrc } from './images';

interface OptionRow {
  name: string;
  values: string;
}

interface VariantRow {
  id?: string;
  price: string;
  compareAtPrice: string;
  costPerItem: string;
  sku: string;
  barcode: string;
  weightGrams: string;
  inventoryQuantity: string;
  trackInventory: boolean;
  allowBackorder: boolean;
  requiresShipping: boolean;
  taxable: boolean;
  countryOfOrigin: string;
  hsCode: string;
}

interface MetafieldRow {
  uid: number;
  namespace: string;
  key: string;
  type: MetafieldType;
  value: string;
  showOnStorefront: boolean;
  touched: boolean;
}

const FORM_ID = 'product-form';
const SEP = '\u0000';
const emptyVariant = (): VariantRow => ({
  price: '',
  compareAtPrice: '',
  costPerItem: '',
  sku: '',
  barcode: '',
  weightGrams: '0',
  inventoryQuantity: '0',
  trackInventory: true,
  allowBackorder: false,
  requiresShipping: true,
  taxable: true,
  countryOfOrigin: '',
  hsCode: '',
});

const METAFIELD_TYPES: { value: MetafieldType; label: string }[] = [
  { value: 'single_line_text', label: 'Single line text' },
  { value: 'multi_line_text', label: 'Multi-line text' },
  { value: 'number_integer', label: 'Integer' },
  { value: 'number_decimal', label: 'Decimal' },
  { value: 'boolean', label: 'True or false' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
];

function splitList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}

function combinations(options: { values: string[] }[]): string[][] {
  return options.reduce<string[][]>(
    (acc, option) => acc.flatMap((prefix) => option.values.map((v) => [...prefix, v])),
    [[]],
  );
}

/** HS codes are 6–10 digits; dots and spaces are accepted and dropped. */
function normalizeHsCode(value: string): string | null {
  const digits = value.replace(/[.\s]/g, '');
  return /^\d{6,10}$/.test(digits) ? digits : null;
}

/** ISO instant -> `YYYY-MM-DDTHH:mm` in the viewer's time zone (for datetime-local). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const input = `${inputClass} w-full py-2`;
const cellInput = `${inputClass} h-8`;
const label = 'block text-[13px] font-medium text-slate-800';
const hint = 'text-xs leading-5 text-slate-500';

let nextUid = 1;

export function ProductEditor({
  product,
  currency,
  action,
  canWrite,
  media,
  aside,
  suggestions,
  setVariantImage,
}: {
  product: Product | null;
  currency: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  canWrite: boolean;
  /** The media manager (its own actions; kept outside the product form). */
  media?: ReactNode;
  /** Extra sidebar cards below the editor's own (duplicate, delete). */
  aside?: ReactNode;
  /** Existing vendors and product types, offered as suggestions. */
  suggestions?: { vendors: string[]; productTypes: string[] };
  setVariantImage?: (variantId: string, imageId: string | null) => Promise<ActionResult>;
}) {
  const [state, formAction, saving] = useActionState(action, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const hydrated = useHydrated();
  // Reference time for the publish hint (render must stay pure).
  const [now] = useState(() => Date.now());
  const countries = useCountryOptions();

  const [title, setTitle] = useState(product?.title ?? '');
  const [handle, setHandle] = useState(product?.handle ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [status, setStatus] = useState(product?.status ?? 'DRAFT');
  const [vendor, setVendor] = useState(product?.vendor ?? '');
  const [productType, setProductType] = useState(product?.productType ?? '');
  const [tags, setTags] = useState(product?.tags.join(', ') ?? '');
  const [seoTitle, setSeoTitle] = useState(product?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(product?.seoDescription ?? '');
  const [isGiftCard, setIsGiftCard] = useState(product?.isGiftCard ?? false);
  /** null = untouched (keep the stored publish time); '' = publish now; otherwise local time. */
  const [publishAt, setPublishAt] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionRow[]>(
    product?.options.map((o) => ({ name: o.name, values: o.values.join(', ') })) ?? [],
  );
  const [variants, setVariants] = useState<Record<string, VariantRow>>(() => {
    const map: Record<string, VariantRow> = {};
    for (const v of product?.variants ?? []) {
      map[v.options.join(SEP)] = {
        id: v.id,
        price: minorToDecimalString(v.price, currency),
        compareAtPrice:
          v.compareAtPrice == null ? '' : minorToDecimalString(v.compareAtPrice, currency),
        costPerItem: v.costPerItem == null ? '' : minorToDecimalString(v.costPerItem, currency),
        sku: v.sku ?? '',
        barcode: v.barcode ?? '',
        weightGrams: String(v.weightGrams),
        inventoryQuantity: String(v.inventoryQuantity),
        trackInventory: v.trackInventory,
        allowBackorder: v.allowBackorder,
        requiresShipping: v.requiresShipping,
        taxable: v.taxable,
        countryOfOrigin: v.countryOfOrigin ?? '',
        hsCode: v.hsCode ?? '',
      };
    }
    return map;
  });
  const [metafields, setMetafields] = useState<MetafieldRow[]>(
    () =>
      product?.metafields.map((m) => ({
        uid: nextUid++,
        namespace: m.namespace,
        key: m.key,
        type: m.type,
        value: m.value,
        showOnStorefront: m.showOnStorefront,
        touched: false,
      })) ?? [],
  );

  const parsedOptions = useMemo(
    () =>
      options
        .map((o) => ({ name: o.name.trim(), values: splitList(o.values) }))
        .filter((o) => o.name && o.values.length > 0),
    [options],
  );
  const combos = useMemo(() => combinations(parsedOptions), [parsedOptions]);
  const rowFor = (combo: string[]) => variants[combo.join(SEP)] ?? emptyVariant();
  const updateRow = (combo: string[], patch: Partial<VariantRow>) =>
    setVariants((prev) => ({ ...prev, [combo.join(SEP)]: { ...rowFor(combo), ...patch } }));

  const metafieldErrors = useMemo(() => {
    const seen = new Map<string, number>();
    for (const m of metafields) {
      const id = `${m.namespace}.${m.key}`;
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    return metafields.map((m) => {
      let key: string | undefined;
      if (!m.key) key = 'Enter a key';
      else if (!/^[a-z0-9_]{1,40}$/.test(m.key))
        key = 'Use 1–40 lowercase letters, numbers and underscores';
      else if ((seen.get(`${m.namespace}.${m.key}`) ?? 0) > 1) key = 'Each key can be used once';
      const result = normalizeMetafieldValue(m.type, m.value);
      return { key, value: 'error' in result ? result.error : undefined };
    });
  }, [metafields]);

  const scheduledAt = product?.scheduled && product.publishedAt ? product.publishedAt : null;
  const publishInput = publishAt ?? (hydrated && scheduledAt ? toLocalInput(scheduledAt) : '');

  const payload = useMemo(() => {
    return {
      title,
      handle: handle.trim() || undefined,
      description,
      status,
      vendor,
      productType,
      tags: splitList(tags),
      seoTitle,
      seoDescription,
      isGiftCard,
      // Untouched: keep whatever is stored. Cleared: publish now (drops a schedule).
      publishAt:
        publishAt === null || status !== 'ACTIVE'
          ? undefined
          : publishAt
            ? new Date(publishAt).toISOString()
            : null,
      options: parsedOptions,
      variants: combos.map((combo) => {
        const row = variants[combo.join(SEP)] ?? emptyVariant();
        return {
          id: row.id,
          options: combo,
          sku: row.sku,
          barcode: row.barcode,
          price: parseMoney(row.price, currency),
          compareAtPrice: row.compareAtPrice ? parseMoney(row.compareAtPrice, currency) : null,
          costPerItem: row.costPerItem.trim() ? parseMoney(row.costPerItem, currency) : null,
          weightGrams: Number.parseInt(row.weightGrams || '0', 10),
          requiresShipping: row.requiresShipping,
          countryOfOrigin: row.countryOfOrigin || null,
          hsCode: row.hsCode.trim() ? (normalizeHsCode(row.hsCode) ?? row.hsCode) : null,
          taxable: row.taxable,
          trackInventory: row.trackInventory,
          allowBackorder: row.allowBackorder,
          inventoryQuantity: row.id ? undefined : Number.parseInt(row.inventoryQuantity || '0', 10),
        };
      }),
      // Replaces all custom fields; a new product without any sends nothing.
      metafields:
        product || metafields.length
          ? metafields.map((m) => {
              const normalized = normalizeMetafieldValue(m.type, m.value);
              return {
                namespace: m.namespace,
                key: m.key,
                type: m.type,
                value: 'value' in normalized ? normalized.value : m.value,
                showOnStorefront: m.showOnStorefront,
              };
            })
          : undefined,
    };
  }, [
    title,
    handle,
    description,
    status,
    vendor,
    productType,
    tags,
    seoTitle,
    seoDescription,
    isGiftCard,
    publishAt,
    parsedOptions,
    combos,
    variants,
    currency,
    metafields,
    product,
  ]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitted(true);
    const rows = combos.map(rowFor);
    let error: string | null = null;
    if (!title.trim()) error = 'Enter a title.';
    else if (payload.variants.some((v) => v.price === null))
      error = 'Enter a valid price for every variant (e.g. 19.99).';
    else if (
      rows.some((r) => r.compareAtPrice !== '' && parseMoney(r.compareAtPrice, currency) === null)
    )
      error = 'Compare-at prices must be valid amounts (or left empty).';
    else if (
      payload.variants.some((v) => v.costPerItem === null && rowFor(v.options).costPerItem.trim())
    )
      error = 'Cost per item must be a valid amount (or left empty).';
    else if (rows.some((r) => r.hsCode.trim() && !normalizeHsCode(r.hsCode)))
      error = 'HS codes have 6 to 10 digits (for example 6205.20).';
    else if (metafieldErrors.some((e) => e.key || e.value))
      error = 'Fix the highlighted custom fields.';
    else if (status === 'ACTIVE' && publishAt && Number.isNaN(new Date(publishAt).getTime()))
      error = 'Enter a valid publish date.';
    setClientError(error);
    if (error) event.preventDefault();
  }

  const errorList = Object.entries(state?.fieldErrors ?? {});
  const imagesById = new Map((product?.images ?? []).map((i) => [i.id, i]));
  const savedVariants = new Map((product?.variants ?? []).map((v) => [v.id, v]));
  const canPickImages = Boolean(product && setVariantImage);

  return (
    <div className="space-y-6">
      <form id={FORM_ID} action={formAction} onSubmit={onSubmit} className="contents">
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      </form>
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
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <fieldset disabled={!canWrite} className="space-y-6 [&_.space-y-1]:space-y-1.5">
            <Card title="Details">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="p-title" className={label}>
                    Title
                  </label>
                  <input
                    id="p-title"
                    form={FORM_ID}
                    className={input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={200}
                    placeholder="Short sleeve t-shirt"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="p-description" className={label}>
                    Description
                  </label>
                  <textarea
                    id="p-description"
                    className={input}
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={20000}
                  />
                  <p className={hint}>
                    Plain text. Blank lines become paragraphs on the storefront.
                  </p>
                </div>
              </div>
            </Card>
          </fieldset>

          {media}

          <fieldset disabled={!canWrite} className="space-y-6 [&_.space-y-1]:space-y-1.5">
            <Card
              title="Options"
              description="Add options like size or color to create variants (up to 3)."
              actions={
                options.length < 3 ? (
                  <button
                    type="button"
                    className={buttonClass('secondary', 'sm')}
                    onClick={() => setOptions((o) => [...o, { name: '', values: '' }])}
                  >
                    <Icon name="plus" className="-ml-0.5 h-4 w-4" strokeWidth={2} />
                    Add option
                  </button>
                ) : null
              }
            >
              {options.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                  This product has a single default variant.
                </p>
              ) : (
                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
                    >
                      <div className="space-y-1">
                        <label htmlFor={`opt-name-${index}`} className={label}>
                          Option name
                        </label>
                        <input
                          id={`opt-name-${index}`}
                          form={FORM_ID}
                          className={input}
                          value={option.name}
                          placeholder="Size"
                          onChange={(e) =>
                            setOptions((o) =>
                              o.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`opt-values-${index}`} className={label}>
                          Values (comma separated)
                        </label>
                        <input
                          id={`opt-values-${index}`}
                          form={FORM_ID}
                          className={input}
                          value={option.values}
                          placeholder="S, M, L"
                          onChange={(e) =>
                            setOptions((o) =>
                              o.map((x, i) => (i === index ? { ...x, values: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className={`${buttonClass('ghost')} text-red-600 hover:text-red-700`}
                        onClick={() => setOptions((o) => o.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card
              title="Variants"
              description={
                <>
                  Prices in {currency}. Cost per item is private: customers never see it.
                  {product ? ' Stock for existing variants is changed on the Inventory page.' : ''}
                </>
              }
              flush
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm [&_td]:py-2 [&_td]:pr-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-medium whitespace-nowrap text-slate-500 [&_th]:py-2.5 [&_th]:pr-3 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
                      {canPickImages ? (
                        <th>
                          <span className="sr-only">Image</span>
                        </th>
                      ) : null}
                      <th>Variant</th>
                      <th>Price</th>
                      <th>Compare at</th>
                      <th>Cost per item</th>
                      <th>Profit</th>
                      <th>SKU</th>
                      <th>Stock</th>
                      <th>Track</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {combos.map((combo) => {
                      const row = rowFor(combo);
                      const name = combo.length ? combo.join(' / ') : 'Default';
                      const price = parseMoney(row.price, currency);
                      const cost = row.costPerItem.trim()
                        ? parseMoney(row.costPerItem, currency)
                        : null;
                      const costInvalid = row.costPerItem.trim() !== '' && cost === null;
                      const profit = price !== null && cost !== null ? price - cost : null;
                      const margin =
                        profit !== null && price ? Math.round((profit / price) * 1000) / 10 : null;
                      const saved = row.id ? savedVariants.get(row.id) : undefined;
                      return (
                        <tr key={combo.join(SEP) || 'default'}>
                          {canPickImages ? (
                            <td className="w-12">
                              <VariantImageCell
                                name={name}
                                variantId={saved?.id}
                                imageId={saved?.imageId ?? null}
                                images={product?.images ?? []}
                                imagesById={imagesById}
                                disabled={!canWrite}
                                setVariantImage={setVariantImage!}
                              />
                            </td>
                          ) : null}
                          <td className="font-medium whitespace-nowrap text-slate-900">{name}</td>
                          <td>
                            <input
                              aria-label={`Price for ${name}`}
                              form={FORM_ID}
                              className={`${cellInput} w-24`}
                              inputMode="decimal"
                              value={row.price}
                              onChange={(e) => updateRow(combo, { price: e.target.value })}
                              placeholder="0.00"
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Compare-at price for ${name}`}
                              form={FORM_ID}
                              className={`${cellInput} w-24`}
                              inputMode="decimal"
                              value={row.compareAtPrice}
                              onChange={(e) => updateRow(combo, { compareAtPrice: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Cost per item for ${name}`}
                              form={FORM_ID}
                              className={`${cellInput} w-24 aria-[invalid=true]:border-red-500`}
                              inputMode="decimal"
                              value={row.costPerItem}
                              aria-invalid={costInvalid || undefined}
                              placeholder="0.00"
                              onChange={(e) => updateRow(combo, { costPerItem: e.target.value })}
                            />
                          </td>
                          <td className="whitespace-nowrap tabular-nums" aria-live="polite">
                            {profit !== null ? (
                              <span className="flex flex-col leading-tight">
                                <span className={profit < 0 ? 'text-red-600' : 'text-slate-900'}>
                                  {formatMoney(profit, currency)}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {margin === null ? '—' : `${margin}% margin`}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td>
                            <input
                              aria-label={`SKU for ${name}`}
                              form={FORM_ID}
                              className={`${cellInput} w-28`}
                              value={row.sku}
                              onChange={(e) => updateRow(combo, { sku: e.target.value })}
                            />
                          </td>
                          <td>
                            {row.id ? (
                              <span className="text-slate-700 tabular-nums">
                                {row.trackInventory ? row.inventoryQuantity : '—'}
                              </span>
                            ) : (
                              <input
                                aria-label={`Starting stock for ${name}`}
                                form={FORM_ID}
                                className={`${cellInput} w-20`}
                                inputMode="numeric"
                                value={row.inventoryQuantity}
                                disabled={!row.trackInventory}
                                onChange={(e) =>
                                  updateRow(combo, {
                                    inventoryQuantity: e.target.value.replace(/\D/g, ''),
                                  })
                                }
                              />
                            )}
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Track inventory for ${name}`}
                              checked={row.trackInventory}
                              onChange={(e) =>
                                updateRow(combo, { trackInventory: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card
              title="Shipping and customs"
              description="Used for shipping rates and customs forms on international orders. Customers don't see it."
              flush
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm [&_td]:py-2 [&_td]:pr-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-medium whitespace-nowrap text-slate-500 [&_th]:py-2.5 [&_th]:pr-3 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
                      <th>Variant</th>
                      <th>Weight (g)</th>
                      <th>Country/Region of origin</th>
                      <th>HS code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {combos.map((combo) => {
                      const row = rowFor(combo);
                      const name = combo.length ? combo.join(' / ') : 'Default';
                      const hsInvalid = row.hsCode.trim() !== '' && !normalizeHsCode(row.hsCode);
                      const known = countries.some((c) => c.code === row.countryOfOrigin);
                      return (
                        <tr key={combo.join(SEP) || 'default'}>
                          <td className="font-medium whitespace-nowrap text-slate-900">{name}</td>
                          <td>
                            <input
                              aria-label={`Weight for ${name}`}
                              form={FORM_ID}
                              className={`${cellInput} w-24`}
                              inputMode="numeric"
                              value={row.weightGrams}
                              onChange={(e) =>
                                updateRow(combo, { weightGrams: e.target.value.replace(/\D/g, '') })
                              }
                            />
                          </td>
                          <td>
                            <select
                              aria-label={`Country/Region of origin for ${name}`}
                              className={`${cellInput} w-52 py-0`}
                              value={row.countryOfOrigin}
                              onChange={(e) =>
                                updateRow(combo, { countryOfOrigin: e.target.value })
                              }
                            >
                              <option value="">Not set</option>
                              {row.countryOfOrigin && !known ? (
                                <option value={row.countryOfOrigin}>{row.countryOfOrigin}</option>
                              ) : null}
                              {countries.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              aria-label={`HS code for ${name}`}
                              form={FORM_ID}
                              className={`${cellInput} w-32 aria-[invalid=true]:border-red-500`}
                              inputMode="numeric"
                              value={row.hsCode}
                              placeholder="6205.20"
                              maxLength={14}
                              aria-invalid={hsInvalid || undefined}
                              title={hsInvalid ? 'Use 6 to 10 digits' : undefined}
                              onChange={(e) => updateRow(combo, { hsCode: e.target.value })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                HS (Harmonized System) codes have 6 to 10 digits; dots and spaces are ignored.
              </p>
            </Card>

            <MetafieldsCard
              rows={metafields}
              errors={metafieldErrors}
              serverErrors={state?.fieldErrors}
              showAll={submitted}
              onChange={setMetafields}
            />

            <Card
              title="Search engine listing"
              description="How this product can appear in search results."
            >
              <div className="space-y-4">
                <div
                  aria-hidden
                  className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3"
                >
                  <p className="truncate text-xs text-slate-500">
                    /products/{handle.trim() || slugify(title) || 'my-product'}
                  </p>
                  <p className="mt-0.5 truncate text-[15px] text-[#1a0dab]">
                    {seoTitle.trim() || title.trim() || 'Product title'}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-600">
                    {seoDescription.trim() ||
                      description.trim().slice(0, 160) ||
                      'Add a description to show a summary here.'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="p-handle" className={label}>
                    URL handle
                  </label>
                  <input
                    id="p-handle"
                    form={FORM_ID}
                    className={input}
                    value={handle}
                    placeholder={slugify(title) || 'my-product'}
                    onChange={(e) => setHandle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="p-seo-title" className={label}>
                    Page title
                  </label>
                  <input
                    id="p-seo-title"
                    form={FORM_ID}
                    className={input}
                    value={seoTitle}
                    maxLength={70}
                    onChange={(e) => setSeoTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="p-seo-desc" className={label}>
                    Meta description
                  </label>
                  <textarea
                    id="p-seo-desc"
                    className={input}
                    rows={2}
                    value={seoDescription}
                    maxLength={320}
                    onChange={(e) => setSeoDescription(e.target.value)}
                  />
                </div>
              </div>
            </Card>
          </fieldset>
        </div>

        <div className="min-w-0 space-y-6">
          <fieldset disabled={!canWrite} className="space-y-6 [&_.space-y-1]:space-y-1.5">
            <Card>
              <div className="space-y-1">
                <label
                  htmlFor="p-status"
                  className="block text-[15px] leading-6 font-semibold text-slate-900"
                >
                  Status
                </label>
                <select
                  id="p-status"
                  className={input}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-slate-900">Publishing</h3>
                  {product?.scheduled && scheduledAt ? (
                    <Badge tone="blue">Scheduled</Badge>
                  ) : product?.status === 'ACTIVE' && product.publishedAt ? (
                    <Badge tone="green">Published</Badge>
                  ) : null}
                </div>
                {status === 'ACTIVE' ? (
                  <div className="mt-2 space-y-1">
                    <label htmlFor="p-publish-at" className={label}>
                      Publish date
                    </label>
                    {hydrated ? (
                      <input
                        id="p-publish-at"
                        form={FORM_ID}
                        type="datetime-local"
                        className={input}
                        value={publishInput}
                        onChange={(e) => setPublishAt(e.target.value)}
                      />
                    ) : (
                      <div className={`${input} h-[38px] bg-slate-50`} aria-hidden />
                    )}
                    <p className={hint}>
                      {hydrated ? (
                        <PublishHint value={publishInput} product={product} now={now} />
                      ) : (
                        ' '
                      )}
                    </p>
                    {publishInput ? (
                      <button
                        type="button"
                        className="text-[13px] font-medium text-indigo-600 hover:text-indigo-500"
                        onClick={() => setPublishAt('')}
                      >
                        Publish as soon as I save
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className={`mt-1.5 ${hint}`}>
                    Drafts and archived products are hidden from shoppers. Set the product to Active
                    to publish it now or schedule a date.
                  </p>
                )}
              </div>
            </Card>

            <Card title="Product organization">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="p-type" className={label}>
                    Product type
                  </label>
                  <input
                    id="p-type"
                    form={FORM_ID}
                    className={input}
                    list="p-type-suggestions"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    maxLength={100}
                    placeholder="e.g. Shirts"
                  />
                  <datalist id="p-type-suggestions">
                    {suggestions?.productTypes.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label htmlFor="p-vendor" className={label}>
                    Vendor
                  </label>
                  <input
                    id="p-vendor"
                    form={FORM_ID}
                    className={input}
                    list="p-vendor-suggestions"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    maxLength={100}
                  />
                  <datalist id="p-vendor-suggestions">
                    {suggestions?.vendors.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label htmlFor="p-tags" className={label}>
                    Tags
                  </label>
                  <input
                    id="p-tags"
                    form={FORM_ID}
                    className={input}
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="summer, cotton"
                  />
                  <p className={hint}>
                    Comma separated. Tags power automated collections and search.
                  </p>
                </div>
                <label className="flex items-start gap-2 border-t border-slate-100 pt-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isGiftCard}
                    onChange={(e) => setIsGiftCard(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    Sell as a gift card
                    <span className="block text-xs leading-5 text-slate-500">
                      Each variant is a denomination. Paid orders email the buyer a code; no
                      shipping, tax or stock tracking.
                    </span>
                  </span>
                </label>
              </div>
            </Card>
          </fieldset>
          {aside}
        </div>
      </div>

      {canWrite ? (
        <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-xl border border-slate-200/90 bg-white/90 px-4 py-3 shadow-raised backdrop-blur">
          <p className="mr-auto hidden text-[13px] text-slate-500 sm:block">
            {product
              ? 'Changes go live when saved.'
              : 'New products start as drafts unless you set them to Active.'}
          </p>
          <button type="submit" form={FORM_ID} className={buttonClass('primary')} disabled={saving}>
            {saving ? 'Saving…' : product ? 'Save product' : 'Create product'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PublishHint({
  value,
  product,
  now,
}: {
  value: string;
  product: Product | null;
  now: number;
}) {
  if (!value) {
    if (product?.status === 'ACTIVE' && product.publishedAt && !product.scheduled) {
      return <>Published {formatDateTime(product.publishedAt)}.</>;
    }
    return <>Leave empty to publish as soon as you save.</>;
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return <>Enter a date and time.</>;
  return at.getTime() > now ? (
    <>Hidden from shoppers until {formatDateTime(at.toISOString())} (your time).</>
  ) : (
    <>A past date publishes now and shows as published on that date.</>
  );
}

// ── Variant image ────────────────────────────────────────────────────────────────

function VariantImageCell({
  name,
  variantId,
  imageId,
  images,
  imagesById,
  disabled,
  setVariantImage,
}: {
  name: string;
  variantId?: string;
  imageId: string | null;
  images: ProductImage[];
  imagesById: Map<string, ProductImage>;
  disabled: boolean;
  setVariantImage: (variantId: string, imageId: string | null) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [current, setOptimistic] = useOptimistic(imageId);
  const image = current ? imagesById.get(current) : undefined;

  if (!variantId) {
    return (
      <span
        title="Save the product to choose an image for this variant"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-300"
      >
        <Icon name="image" className="h-4 w-4" />
      </span>
    );
  }

  function choose(next: string | null) {
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setVariantImage(variantId!, next);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Image for ${name}`}
        title={image ? 'Change image' : 'Choose image'}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border transition-colors ${
          image
            ? 'border-slate-200 bg-slate-50'
            : 'border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600'
        } ${pending ? 'opacity-60' : ''}`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc(image, 200)} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="plus" className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
      {open ? (
        <Dialog
          title={`Image for ${name}`}
          description="Shoppers see this image when they pick the variant."
          size="lg"
          onClose={() => {
            setOpen(false);
            setError(null);
          }}
        >
          {error ? (
            <div className="mb-3">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}
          {images.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
              Add images in the Media section first.
            </p>
          ) : (
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
              <li>
                <button
                  type="button"
                  aria-pressed={current === null}
                  disabled={pending}
                  onClick={() => choose(null)}
                  className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium ${
                    current === null
                      ? 'border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/30'
                      : 'border-dashed border-slate-300 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <Icon name="close" className="h-4 w-4" />
                  No image
                </button>
              </li>
              {images.map((img, index) => (
                <li key={img.id}>
                  <button
                    type="button"
                    aria-pressed={current === img.id}
                    aria-label={`Image ${index + 1}${img.alt ? `: ${img.alt}` : ''}`}
                    disabled={pending}
                    onClick={() => choose(img.id)}
                    className={`relative block aspect-square w-full overflow-hidden rounded-lg border ${
                      current === img.id
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(img, 200)} alt="" className="h-full w-full object-cover" />
                    {current === img.id ? (
                      <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dialog>
      ) : null}
    </>
  );
}

// ── Custom fields ────────────────────────────────────────────────────────────────

function MetafieldsCard({
  rows,
  errors,
  serverErrors,
  showAll,
  onChange,
}: {
  rows: MetafieldRow[];
  errors: { key?: string; value?: string }[];
  serverErrors?: Record<string, string>;
  showAll: boolean;
  onChange: (update: (rows: MetafieldRow[]) => MetafieldRow[]) => void;
}) {
  const baseId = useId();
  const full = rows.length >= MAX_METAFIELDS_PER_PRODUCT;
  const patch = (uid: number, change: Partial<MetafieldRow>) =>
    onChange((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...change } : r)));
  const add = () =>
    onChange((prev) => [
      ...prev,
      {
        uid: nextUid++,
        namespace: 'custom',
        key: '',
        type: 'single_line_text',
        value: '',
        showOnStorefront: true,
        touched: false,
      },
    ]);

  return (
    <Card
      title="Custom fields"
      description="Extra details such as material or care instructions. Choose which ones appear on the product page."
      actions={
        <button
          type="button"
          className={buttonClass('secondary', 'sm')}
          onClick={add}
          disabled={full}
          title={full ? `Up to ${MAX_METAFIELDS_PER_PRODUCT} custom fields` : undefined}
        >
          <Icon name="plus" className="-ml-0.5 h-4 w-4" strokeWidth={2} />
          Add field
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          No custom fields yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const n = index + 1;
            const show = showAll || row.touched;
            const keyError = show ? errors[index]?.key : undefined;
            const valueError =
              (show ? errors[index]?.value : undefined) ??
              (!row.touched ? serverErrors?.[`metafields.${index}.value`] : undefined);
            const keyId = `${baseId}-${index}-key`;
            const typeId = `${baseId}-${index}-type`;
            const valueId = `${baseId}-${index}-value`;
            return (
              <li
                key={row.uid}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                onBlur={() => {
                  if (!row.touched) patch(row.uid, { touched: true });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <div className="space-y-1">
                    <label htmlFor={keyId} className={label}>
                      Key
                      {row.namespace !== 'custom' ? (
                        <span className="ml-1 font-normal text-slate-400">({row.namespace})</span>
                      ) : null}
                    </label>
                    <input
                      id={keyId}
                      form={FORM_ID}
                      className={`${input} font-mono text-[13px] aria-[invalid=true]:border-red-500`}
                      value={row.key}
                      maxLength={40}
                      placeholder="material"
                      aria-invalid={keyError ? true : undefined}
                      aria-describedby={keyError ? `${keyId}-error` : undefined}
                      onChange={(e) =>
                        patch(row.uid, {
                          key: e.target.value.toLowerCase().replace(/[\s-]+/g, '_'),
                        })
                      }
                    />
                    {keyError ? <FieldError id={`${keyId}-error`}>{keyError}</FieldError> : null}
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={typeId} className={label}>
                      Type
                    </label>
                    <select
                      id={typeId}
                      className={input}
                      value={row.type}
                      onChange={(e) => {
                        const type = e.target.value as MetafieldType;
                        const wasBool = row.type === 'boolean';
                        patch(row.uid, {
                          type,
                          value: type === 'boolean' ? 'true' : wasBool ? '' : row.value,
                        });
                      }}
                    >
                      {METAFIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <label htmlFor={valueId} className={label}>
                    Value
                  </label>
                  <MetafieldValueInput
                    id={valueId}
                    row={row}
                    invalid={Boolean(valueError)}
                    describedBy={valueError ? `${valueId}-error` : undefined}
                    onChange={(value) => patch(row.uid, { value })}
                  />
                  {valueError ? (
                    <FieldError id={`${valueId}-error`}>{valueError}</FieldError>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={row.showOnStorefront}
                      onChange={(e) => patch(row.uid, { showOnStorefront: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Show on storefront
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove custom field ${row.key || n}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-red-600 hover:bg-red-50"
                    onClick={() => onChange((prev) => prev.filter((r) => r.uid !== row.uid))}
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500 tabular-nums">
        {rows.length} of {MAX_METAFIELDS_PER_PRODUCT} fields
        {full ? ' · remove one to add another' : ''}
      </p>
    </Card>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1 text-xs leading-5 text-red-600">
      <Icon name="error" className="mt-0.5 h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </p>
  );
}

function MetafieldValueInput({
  id,
  row,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  row: MetafieldRow;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  const common = {
    id,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
    className: `${input} aria-[invalid=true]:border-red-500`,
  };
  switch (row.type) {
    case 'multi_line_text':
      return (
        <textarea
          {...common}
          rows={3}
          maxLength={5000}
          value={row.value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'boolean':
      return (
        <select {...common} value={row.value} onChange={(e) => onChange(e.target.value)}>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    case 'date':
      return (
        <input
          {...common}
          type="date"
          value={row.value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'url':
      return (
        <input
          {...common}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={row.value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number_integer':
    case 'number_decimal':
      return (
        <input
          {...common}
          form={FORM_ID}
          inputMode={row.type === 'number_integer' ? 'numeric' : 'decimal'}
          placeholder={row.type === 'number_integer' ? '42' : '12.5'}
          value={row.value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <input
          {...common}
          form={FORM_ID}
          maxLength={255}
          value={row.value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
