'use client';

import { formatMoney, type StorefrontProduct } from '@repo/contracts';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addToCartAction } from '@/app/cart/actions';

function AddButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full rounded-md bg-brand px-6 py-3 text-sm font-semibold text-brand-contrast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? 'Adding…' : disabled ? 'Sold out' : 'Add to cart'}
    </button>
  );
}

export function VariantPicker({
  product,
  currency,
}: {
  product: StorefrontProduct;
  currency: string;
}) {
  const firstAvailable = product.variants.find((v) => v.available) ?? product.variants[0];
  const [selected, setSelected] = useState<string[]>(firstAvailable?.options ?? []);
  const [state, formAction] = useActionState(addToCartAction, undefined);

  const variant = useMemo(
    () => product.variants.find((v) => v.options.every((value, i) => value === selected[i])),
    [product.variants, selected],
  );

  return (
    <form action={formAction} className="space-y-5">
      {product.options.map((option, index) => (
        <fieldset key={option.name}>
          <legend className="mb-2 text-sm font-medium text-zinc-900">{option.name}</legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const checked = selected[index] === value;
              const id = `opt-${index}-${value}`;
              return (
                <label
                  key={value}
                  htmlFor={id}
                  className={`cursor-pointer rounded-md border px-4 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                    checked
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-300 hover:border-zinc-900'
                  }`}
                >
                  <input
                    id={id}
                    type="radio"
                    name={`option-${index}`}
                    value={value}
                    checked={checked}
                    onChange={() =>
                      setSelected((prev) => prev.map((v, i) => (i === index ? value : v)))
                    }
                    className="sr-only"
                  />
                  {value}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <p className="text-2xl font-semibold" aria-live="polite">
        {variant ? formatMoney(variant.price, currency) : 'Unavailable'}
        {variant?.compareAtPrice && variant.compareAtPrice > variant.price ? (
          <s className="ml-3 text-base font-normal text-zinc-500">
            {formatMoney(variant.compareAtPrice, currency)}
          </s>
        ) : null}
      </p>

      <input type="hidden" name="variantId" value={variant?.id ?? ''} />
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="quantity" className="mb-1 block text-sm font-medium text-zinc-900">
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={99}
            defaultValue={1}
            className="w-20 rounded-md border border-zinc-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex-1">
          <AddButton disabled={!variant?.available} />
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="text-sm text-emerald-700">
          {state.success}{' '}
          <Link href="/cart" className="font-medium underline">
            View cart
          </Link>
        </p>
      ) : null}
    </form>
  );
}
