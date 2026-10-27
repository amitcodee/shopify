'use client';

import {
  type Customization,
  formatMoney,
  type StorefrontProduct,
  type StorefrontVariant,
} from '@repo/contracts';
import Link from 'next/link';

type Option = StorefrontProduct['options'][number];

const LEGEND = 'mb-3 text-[0.8125rem] font-semibold tracking-wide text-zinc-900 uppercase';

/**
 * One product option in the style the merchant chose: buttons (default), a dropdown, or colour
 * swatches. Values that cannot be bought with the other choices are struck through.
 */
export function OptionPicker({
  option,
  index,
  selected,
  purchasable,
  onChoose,
}: {
  option: Option;
  index: number;
  selected: string | undefined;
  purchasable: (value: string) => boolean;
  onChoose: (value: string) => void;
}) {
  const style = option.style ?? 'buttons';
  const legend = (
    <legend className={LEGEND}>
      {option.name}
      {selected ? (
        <span className="font-normal tracking-normal text-zinc-500 normal-case">{` · ${selected}`}</span>
      ) : null}
    </legend>
  );

  if (style === 'dropdown') {
    const id = `opt-${index}`;
    return (
      <div>
        <label htmlFor={id} className={LEGEND + ' block'}>
          {option.name}
        </label>
        <select
          id={id}
          name={`option-${index}`}
          className="field"
          value={selected ?? ''}
          onChange={(e) => onChoose(e.target.value)}
        >
          {option.values.map((value) => (
            <option key={value} value={value}>
              {value}
              {purchasable(value) ? '' : ' — sold out'}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (style === 'swatches') {
    return (
      <fieldset>
        {legend}
        <div className="flex flex-wrap gap-2.5">
          {option.values.map((value, i) => {
            const color = option.swatches?.[i] || '';
            const checked = selected === value;
            const available = purchasable(value);
            const id = `opt-${index}-${value}`;
            return (
              <label
                key={value}
                htmlFor={id}
                title={available ? value : `${value} (sold out)`}
                className={`relative grid size-11 cursor-pointer place-items-center rounded-full transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 ${
                  checked
                    ? 'ring-2 ring-zinc-900 ring-offset-2'
                    : 'ring-1 ring-zinc-300 hover:ring-zinc-500'
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name={`option-${index}`}
                  value={value}
                  checked={checked}
                  onChange={() => onChoose(value)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="size-9 rounded-full ring-1 ring-black/10 ring-inset"
                  style={
                    color
                      ? { backgroundColor: color }
                      : { background: 'linear-gradient(135deg,#f4f4f5,#d4d4d8)' }
                  }
                />
                {color ? null : (
                  <span aria-hidden className="absolute text-[10px] font-semibold text-zinc-700">
                    {value.slice(0, 2)}
                  </span>
                )}
                {available ? null : (
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-full bg-[linear-gradient(to_top_right,transparent_calc(50%-1px),rgb(255_255_255/0.95)_calc(50%-1px),rgb(255_255_255/0.95)_calc(50%+1px),transparent_calc(50%+1px))]"
                  />
                )}
                <span className="sr-only">
                  {value}
                  {available ? '' : ', sold out'}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset>
      {legend}
      <div className="flex flex-wrap gap-2">
        {option.values.map((value) => {
          const checked = selected === value;
          const available = purchasable(value);
          const id = `opt-${index}-${value}`;
          return (
            <label
              key={value}
              htmlFor={id}
              className={`flex h-11 min-w-12 cursor-pointer items-center justify-center rounded-md border px-4 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 ${
                checked
                  ? available
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-900 text-zinc-500 ring-1 ring-zinc-900'
                  : available
                    ? 'border-zinc-300 hover:border-zinc-900'
                    : 'border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              <input
                id={id}
                type="radio"
                name={`option-${index}`}
                value={value}
                checked={checked}
                onChange={() => onChoose(value)}
                className="sr-only"
              />
              <span className={available ? '' : 'line-through decoration-1'}>{value}</span>
              {available ? null : <span className="sr-only">, sold out</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** What a bundle contains, with what the items would cost separately. */
export function BundleContents({
  variant,
  currency,
}: {
  variant: StorefrontVariant;
  currency: string;
}) {
  if (!variant.components?.length) return null;
  const saving =
    variant.componentsPrice != null && variant.componentsPrice > variant.price
      ? variant.componentsPrice - variant.price
      : 0;
  return (
    <section aria-labelledby="bundle-contents" className="rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bundle-contents" className="text-[0.8125rem] font-semibold tracking-wide uppercase">
          What&apos;s inside
        </h2>
        {saving > 0 ? (
          <p className="text-sm font-medium text-emerald-700">
            Save {formatMoney(saving, currency)} vs. buying separately
          </p>
        ) : null}
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {variant.components.map((c) => (
          <li key={`${c.productHandle}-${c.variantTitle}`} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 tabular-nums">
              {c.quantity}
            </span>
            <span>
              <Link href={`/products/${c.productHandle}`} className="font-medium hover:underline">
                {c.productTitle}
              </Link>
              {c.variantTitle !== 'Default' ? (
                <span className="text-zinc-500"> · {c.variantTitle}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Personalisation inputs; their values post as `custom-<id>`. */
export function CustomizationFields({
  fields,
  values,
  currency,
  onChange,
}: {
  fields: Customization[];
  values: Record<string, string>;
  currency: string;
  onChange: (id: string, value: string) => void;
}) {
  if (fields.length === 0) return null;
  const plus = (price: number) => (price > 0 ? ` (+${formatMoney(price, currency)})` : '');
  return (
    <fieldset className="space-y-4">
      <legend className={LEGEND}>Personalise</legend>
      {fields.map((field) => {
        const id = `custom-${field.id}`;
        const value = values[field.id] ?? '';
        const help = field.helpText ? (
          <p id={`${id}-help`} className="mt-1 text-xs text-zinc-500">
            {field.helpText}
          </p>
        ) : null;
        const label = (
          <label htmlFor={id} className="field-label">
            {field.label}
            {field.required ? null : <span className="font-normal text-zinc-500"> (optional)</span>}
            {field.type !== 'select' && field.price > 0 ? (
              <span className="font-normal text-zinc-500">{plus(field.price)}</span>
            ) : null}
          </label>
        );
        switch (field.type) {
          case 'checkbox':
            return (
              <div key={field.id}>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    id={id}
                    name={id}
                    type="checkbox"
                    value="true"
                    required={field.required}
                    checked={value === 'true'}
                    onChange={(e) => onChange(field.id, e.target.checked ? 'true' : '')}
                    aria-describedby={field.helpText ? `${id}-help` : undefined}
                    className="mt-0.5 size-4 rounded border-zinc-400 accent-zinc-900"
                  />
                  <span>
                    <span className="font-medium text-zinc-900">{field.label}</span>
                    {field.price > 0 ? (
                      <span className="text-zinc-500">{plus(field.price)}</span>
                    ) : null}
                  </span>
                </label>
                {help}
              </div>
            );
          case 'select':
            return (
              <div key={field.id}>
                {label}
                <select
                  id={id}
                  name={id}
                  className="field"
                  required={field.required}
                  value={value}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  aria-describedby={field.helpText ? `${id}-help` : undefined}
                >
                  <option value="">{field.required ? 'Choose…' : 'None'}</option>
                  {field.choices.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label}
                      {plus(c.price)}
                    </option>
                  ))}
                </select>
                {help}
              </div>
            );
          case 'textarea':
          case 'text': {
            const common = {
              id,
              name: id,
              className: 'field',
              required: field.required,
              maxLength: field.maxLength,
              value,
              'aria-describedby': `${id}-count${field.helpText ? ` ${id}-help` : ''}`,
            };
            return (
              <div key={field.id}>
                {label}
                {field.type === 'textarea' ? (
                  <textarea
                    {...common}
                    rows={3}
                    onChange={(e) => onChange(field.id, e.target.value)}
                  />
                ) : (
                  <input {...common} onChange={(e) => onChange(field.id, e.target.value)} />
                )}
                <div className="mt-1 flex justify-between gap-3">
                  {help ?? <span />}
                  <p id={`${id}-count`} className="shrink-0 text-xs text-zinc-500 tabular-nums">
                    {value.length}/{field.maxLength}
                  </p>
                </div>
              </div>
            );
          }
        }
      })}
    </fieldset>
  );
}

/** Extra price of the current answers (what the API will add). */
export function customizationExtra(
  fields: Customization[],
  values: Record<string, string>,
): number {
  return fields.reduce((sum, f) => {
    const value = (values[f.id] ?? '').trim();
    if (!value) return sum;
    if (f.type === 'select') return sum + (f.choices.find((c) => c.label === value)?.price ?? 0);
    if (f.type === 'checkbox') return sum + (value === 'true' ? f.price : 0);
    return sum + f.price;
  }, 0);
}
