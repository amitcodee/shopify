'use client';

import { formatMoney, type StorefrontProduct } from '@repo/contracts';
import Link from 'next/link';
import { type ReactNode, useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addToCartAction } from '@/app/(store)/cart/actions';
import { Accordion } from '@/components/product/accordion';
import { ProductIcon } from '@/components/product/icons';
import {
  BundleContents,
  customizationExtra,
  CustomizationFields,
  OptionPicker,
} from '@/components/product/product-options';
import { announceVariantImage, initialVariant } from '@/components/product/variant-image';
import { percentOff } from '@/components/product-grid';
import { srcSetFor } from '@/lib/images';

function AddButton({ disabled, className }: { disabled: boolean; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={`btn btn-strong ${className}`}>
      {disabled ? null : <ProductIcon name="bag" className="size-4" />}
      {pending ? 'Adding…' : disabled ? 'Sold out' : 'Add to cart'}
    </button>
  );
}

const BADGE =
  'rounded-sm px-2 py-1 text-[11px] font-semibold uppercase leading-none tracking-wider';

/**
 * Options, price, quantity and the add-to-cart form, plus the parts of the page that follow the
 * selected variant: a sticky add-to-cart bar on phones and the "Details" accordion (its SKU).
 * `children` (trust row, description, shipping) render between the form and "Details".
 * Choosing a variant that has its own image tells the gallery to show it.
 */
export function VariantPicker({
  product,
  currency,
  children,
}: {
  product: StorefrontProduct;
  currency: string;
  children?: ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>(() => initialVariant(product)?.options ?? []);
  const [state, formAction] = useActionState(addToCartAction, undefined);
  const quantity = useRef<HTMLInputElement>(null);
  const buttonRow = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);
  const fields = product.customizations ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const extra = customizationExtra(fields, answers);

  const variant = useMemo(
    () => product.variants.find((v) => v.options.every((value, i) => value === selected[i])),
    [product.variants, selected],
  );

  const choose = (index: number, value: string) => {
    const next = selected.map((v, i) => (i === index ? value : v));
    setSelected(next);
    const match = product.variants.find((v) => v.options.every((o, i) => o === next[i]));
    if (match?.imageId) announceVariantImage({ productId: product.id, imageId: match.imageId });
  };

  /** Whether choosing `value` for option `index` (keeping the other choices) can be bought. */
  const purchasable = (index: number, value: string) => {
    const options = selected.map((v, i) => (i === index ? value : v));
    return product.variants.some((v) => v.available && v.options.every((o, i) => o === options[i]));
  };

  // The header's cart (count, slide-out drawer) listens for this.
  useEffect(() => {
    if (state?.success) window.dispatchEvent(new CustomEvent('cart:added'));
  }, [state]);

  // Phones: once the add-to-cart row has scrolled up out of view, offer a sticky bar instead.
  useEffect(() => {
    const row = buttonRow.current;
    if (!row || typeof IntersectionObserver === 'undefined') return;
    const phone = window.matchMedia('(max-width: 767px)');
    let past = false;
    const update = () => setSticky(phone.matches && past);
    const observer = new IntersectionObserver(([entry]) => {
      past = !!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0;
      update();
    });
    observer.observe(row);
    phone.addEventListener('change', update);
    return () => {
      observer.disconnect();
      phone.removeEventListener('change', update);
    };
  }, []);

  const bump = (delta: number) => {
    const input = quantity.current;
    if (!input) return;
    const next = Math.min(99, Math.max(1, (Number(input.value) || 1) + delta));
    input.value = String(next);
  };

  const off = variant ? percentOff(variant.price, variant.compareAtPrice) : 0;
  const thumb =
    (variant?.imageId && product.images.find((image) => image.id === variant.imageId)) ||
    product.images[0];
  const details = [
    product.vendor ? ['Brand', product.vendor] : null,
    product.productType ? ['Type', product.productType] : null,
    variant?.sku ? ['SKU', variant.sku] : null,
  ].filter((row): row is [string, string] => row !== null);

  return (
    <>
      <form action={formAction} className="space-y-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
          <span
            className={`price-now text-2xl tabular-nums sm:text-[1.75rem] ${off > 0 ? 'text-red-700' : ''}`}
          >
            {variant ? formatMoney(variant.price + extra, currency) : 'Unavailable'}
          </span>
          {variant && off > 0 ? (
            <s className="text-lg text-zinc-500">
              <span className="sr-only">Regular price </span>
              {formatMoney(variant.compareAtPrice ?? 0, currency)}
            </s>
          ) : null}
          {variant && !variant.available ? (
            <span className={`${BADGE} bg-zinc-900 text-white`}>Sold out</span>
          ) : off > 0 ? (
            <span className={`${BADGE} bg-accent text-accent-contrast`}>Sale −{off}%</span>
          ) : null}
        </div>

        {extra > 0 && variant ? (
          <p className="-mt-4 text-sm text-zinc-500">
            Includes {formatMoney(extra, currency)} for personalisation.
          </p>
        ) : null}

        {product.options.map((option, index) => (
          <OptionPicker
            key={option.name}
            option={option}
            index={index}
            selected={selected[index]}
            purchasable={(value) => purchasable(index, value)}
            onChoose={(value) => choose(index, value)}
          />
        ))}

        {variant ? <BundleContents variant={variant} currency={currency} /> : null}

        <CustomizationFields
          fields={fields}
          values={answers}
          currency={currency}
          onChange={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
        />

        <input type="hidden" name="variantId" value={variant?.id ?? ''} />
        <div ref={buttonRow} className="flex items-end gap-3">
          <div>
            <label htmlFor="quantity" className="mb-2 block text-sm font-medium text-zinc-900">
              Quantity
            </label>
            <div className="flex h-[3.25rem] items-center rounded-[var(--store-button-radius)] border border-zinc-300 focus-within:border-zinc-900">
              <button
                type="button"
                onClick={() => bump(-1)}
                aria-label="Decrease"
                aria-controls="quantity"
                className="grid h-full w-10 place-items-center text-zinc-600 transition hover:text-zinc-900"
              >
                <ProductIcon name="minus" className="size-4" />
              </button>
              <input
                ref={quantity}
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                defaultValue={1}
                className="h-full w-10 bg-transparent text-center text-sm font-medium [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => bump(1)}
                aria-label="Increase"
                aria-controls="quantity"
                className="grid h-full w-10 place-items-center text-zinc-600 transition hover:text-zinc-900"
              >
                <ProductIcon name="plus" className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex-1">
            <AddButton disabled={!variant?.available} className="h-[3.25rem] w-full px-6 text-sm" />
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

        {sticky ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-page px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_-14px_rgb(0_0_0/0.3)] transition-transform duration-300 starting:translate-y-full md:hidden">
            <div className="flex items-center gap-3">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb.url}
                  srcSet={srcSetFor(thumb.url, thumb.renditions, thumb.width)}
                  sizes="44px"
                  alt=""
                  className="size-11 shrink-0 rounded-md bg-zinc-100 object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{product.title}</p>
                <p className="text-sm text-zinc-600">
                  {variant ? formatMoney(variant.price + extra, currency) : 'Unavailable'}
                </p>
              </div>
              <AddButton disabled={!variant?.available} className="h-11 shrink-0 px-5 text-sm" />
            </div>
          </div>
        ) : null}
      </form>

      {children}

      {details.length > 0 ? (
        <Accordion title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            {details.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-zinc-500">{term}</dt>
                <dd className="text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Accordion>
      ) : null}
    </>
  );
}
