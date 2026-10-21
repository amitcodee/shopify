'use client';

import { minorToDecimalString, parseMoney, type Product, slugify } from '@repo/contracts';
import { type FormEvent, useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, buttonClass, Card } from '@/components/ui';
import type { FormState } from '@/lib/form';

interface OptionRow {
  name: string;
  values: string;
}

interface VariantRow {
  id?: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  barcode: string;
  weightGrams: string;
  inventoryQuantity: string;
  trackInventory: boolean;
  allowBackorder: boolean;
  requiresShipping: boolean;
  taxable: boolean;
}

const SEP = '\u0000';
const emptyVariant = (): VariantRow => ({
  price: '',
  compareAtPrice: '',
  sku: '',
  barcode: '',
  weightGrams: '0',
  inventoryQuantity: '0',
  trackInventory: true,
  allowBackorder: false,
  requiresShipping: true,
  taxable: true,
});

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

const input =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30';
const label = 'block text-sm font-medium text-slate-700';

function Submit({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={buttonClass('primary')} disabled={pending}>
      {pending ? 'Saving…' : isNew ? 'Create product' : 'Save product'}
    </button>
  );
}

export function ProductEditor({
  product,
  currency,
  action,
  canWrite,
}: {
  product: Product | null;
  currency: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  canWrite: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [clientError, setClientError] = useState<string | null>(null);

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
        sku: v.sku ?? '',
        barcode: v.barcode ?? '',
        weightGrams: String(v.weightGrams),
        inventoryQuantity: String(v.inventoryQuantity),
        trackInventory: v.trackInventory,
        allowBackorder: v.allowBackorder,
        requiresShipping: v.requiresShipping,
        taxable: v.taxable,
      };
    }
    return map;
  });

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
          weightGrams: Number.parseInt(row.weightGrams || '0', 10),
          requiresShipping: row.requiresShipping,
          taxable: row.taxable,
          trackInventory: row.trackInventory,
          allowBackorder: row.allowBackorder,
          inventoryQuantity: row.id ? undefined : Number.parseInt(row.inventoryQuantity || '0', 10),
        };
      }),
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
    parsedOptions,
    combos,
    variants,
    currency,
  ]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const badPrice = payload.variants.find((v) => v.price === null);
    if (!title.trim()) {
      setClientError('Enter a title.');
      event.preventDefault();
    } else if (badPrice) {
      setClientError(`Enter a valid price for every variant (e.g. 19.99).`);
      event.preventDefault();
    } else if (
      combos.some((combo) => {
        const raw = rowFor(combo).compareAtPrice;
        return raw !== '' && parseMoney(raw, currency) === null;
      })
    ) {
      setClientError('Compare-at prices must be valid amounts (or left empty).');
      event.preventDefault();
    } else {
      setClientError(null);
    }
  }

  const errorList = Object.entries(state?.fieldErrors ?? {});

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
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}

      <fieldset disabled={!canWrite} className="space-y-6">
        <Card title="Details">
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="p-title" className={label}>
                Title
              </label>
              <input
                id="p-title"
                className={input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="p-description" className={label}>
                Description
              </label>
              <textarea
                id="p-description"
                className={input}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={20000}
              />
              <p className="text-xs text-slate-500">
                Plain text. Blank lines become paragraphs on the storefront.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="p-status" className={label}>
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
              <div className="space-y-1">
                <label htmlFor="p-vendor" className={label}>
                  Vendor
                </label>
                <input
                  id="p-vendor"
                  className={input}
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="p-type" className={label}>
                  Product type
                </label>
                <input
                  id="p-type"
                  className={input}
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isGiftCard}
                onChange={(e) => setIsGiftCard(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                Sell as a gift card
                <span className="block text-xs text-slate-500">
                  Each variant is a denomination. Paid orders email the buyer a gift card code; no
                  shipping, tax or stock tracking.
                </span>
              </span>
            </label>
            <div className="space-y-1">
              <label htmlFor="p-tags" className={label}>
                Tags
              </label>
              <input
                id="p-tags"
                className={input}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="summer, cotton"
              />
              <p className="text-xs text-slate-500">
                Comma separated. Tags power automated collections and search.
              </p>
            </div>
          </div>
        </Card>

        <Card
          title="Options"
          description="Add options like size or color to create variants (up to 3)."
          actions={
            options.length < 3 ? (
              <button
                type="button"
                className={buttonClass('secondary')}
                onClick={() => setOptions((o) => [...o, { name: '', values: '' }])}
              >
                Add option
              </button>
            ) : null
          }
        >
          {options.length === 0 ? (
            <p className="text-sm text-slate-500">This product has a single default variant.</p>
          ) : (
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                  <div className="space-y-1">
                    <label htmlFor={`opt-name-${index}`} className={label}>
                      Option name
                    </label>
                    <input
                      id={`opt-name-${index}`}
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
                    className={buttonClass('ghost')}
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
          description={`Prices in ${currency}. Stock for existing variants is changed on the Inventory page.`}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Variant</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Compare at</th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Weight (g)</th>
                  <th className="py-2 pr-3">Stock</th>
                  <th className="py-2 pr-3">Track</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combos.map((combo) => {
                  const row = rowFor(combo);
                  const name = combo.length ? combo.join(' / ') : 'Default';
                  return (
                    <tr key={combo.join(SEP) || 'default'}>
                      <td className="py-2 pr-3 font-medium text-slate-900">{name}</td>
                      <td className="py-2 pr-3">
                        <input
                          aria-label={`Price for ${name}`}
                          className={`${input} w-28`}
                          inputMode="decimal"
                          value={row.price}
                          onChange={(e) => updateRow(combo, { price: e.target.value })}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          aria-label={`Compare-at price for ${name}`}
                          className={`${input} w-28`}
                          inputMode="decimal"
                          value={row.compareAtPrice}
                          onChange={(e) => updateRow(combo, { compareAtPrice: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          aria-label={`SKU for ${name}`}
                          className={`${input} w-32`}
                          value={row.sku}
                          onChange={(e) => updateRow(combo, { sku: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          aria-label={`Weight for ${name}`}
                          className={`${input} w-24`}
                          inputMode="numeric"
                          value={row.weightGrams}
                          onChange={(e) =>
                            updateRow(combo, { weightGrams: e.target.value.replace(/\D/g, '') })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {row.id ? (
                          <span className="text-slate-700">
                            {row.trackInventory ? row.inventoryQuantity : '—'}
                          </span>
                        ) : (
                          <input
                            aria-label={`Starting stock for ${name}`}
                            className={`${input} w-20`}
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
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          aria-label={`Track inventory for ${name}`}
                          checked={row.trackInventory}
                          onChange={(e) => updateRow(combo, { trackInventory: e.target.checked })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Search engine listing">
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="p-handle" className={label}>
                URL handle
              </label>
              <input
                id="p-handle"
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

      {canWrite ? <Submit isNew={!product} /> : null}
    </form>
  );
}
