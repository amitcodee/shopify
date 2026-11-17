'use client';

import {
  type PremiumStyleId,
  type PremiumTemplate,
  TEMPLATE_LOOKS,
  THEME_INDUSTRIES,
  THEME_PREVIEW_PARAM,
  THEME_STYLES,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import { TemplateScreen } from '@repo/template-preview';
import { useRouter } from 'next/navigation';
import { useActionState, useDeferredValue, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Badge, buttonClass, inputClass } from '@/components/ui';
import type { FormState } from '@/lib/form';
import { loadCheckout } from '@/lib/razorpay-checkout';
import { buyTemplateAction, confirmTemplateAction } from './premium-actions';

/** Whole-rupee premium price, e.g. "₹1,499". */
const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);

type ApplyAction = (state: FormState, formData: FormData) => Promise<FormState>;

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
    active
      ? 'bg-slate-900 text-white ring-slate-900'
      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300'
  }`;

/** Filterable template catalog. Filtering runs in the browser over the bundled catalog. */
export function TemplateGallery({
  storeId,
  currentTemplate,
  storefrontUrl,
  applyAction,
  premium,
}: {
  storeId: string;
  currentTemplate: string;
  storefrontUrl: string;
  /** Present only for staff who can edit the theme. */
  applyAction?: ApplyAction;
  /** Premium styles with whether this store owns them (null when unavailable). */
  premium: PremiumTemplate[] | null;
}) {
  const owned = new Set<string>(premium?.filter((p) => p.owned).map((p) => p.styleId) ?? []);
  const [industry, setIndustry] = useState('all');
  const [look, setLook] = useState('all');
  const [style, setStyle] = useState('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [state, formAction] = useActionState(
    applyAction ?? (async () => undefined),
    undefined as FormState,
  );
  const [dismissed, setDismissed] = useState<FormState>(undefined);

  const needle = deferredQuery.trim().toLowerCase();
  const lookStyles: readonly string[] | undefined = TEMPLATE_LOOKS.find(
    (l) => l.id === look,
  )?.styles;
  const styleOptions = lookStyles
    ? THEME_STYLES.filter((s) => lookStyles.includes(s.id))
    : THEME_STYLES;
  const visible = THEME_TEMPLATES.filter(
    (t) =>
      (!lookStyles || lookStyles.includes(t.style)) &&
      (industry === 'all' || t.industry === industry) &&
      (style === 'all' || t.style === style) &&
      (!needle || t.name.toLowerCase().includes(needle)),
  );
  const filtered = look !== 'all' || industry !== 'all' || style !== 'all' || needle !== '';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div
          role="group"
          aria-label="Look"
          className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"
        >
          {[{ id: 'all', label: 'All looks', description: 'Every design' }, ...TEMPLATE_LOOKS].map(
            (l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={look === l.id}
                onClick={() => {
                  setLook(l.id);
                  setStyle('all');
                }}
                className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  look === l.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400'
                }`}
              >
                <span className="block text-[13px] leading-5 font-semibold">{l.label}</span>
                <span
                  className={`mt-0.5 line-clamp-2 block text-xs leading-4 ${look === l.id ? 'text-white opacity-75' : 'text-slate-500'}`}
                >
                  {l.description}
                </span>
              </button>
            ),
          )}
        </div>
        <div
          role="group"
          aria-label="Industry"
          className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
        >
          <button
            type="button"
            aria-pressed={industry === 'all'}
            onClick={() => setIndustry('all')}
            className={chipClass(industry === 'all')}
          >
            All industries
          </button>
          {THEME_INDUSTRIES.map((i) => (
            <button
              key={i.id}
              type="button"
              aria-pressed={industry === i.id}
              onClick={() => setIndustry(i.id)}
              className={chipClass(industry === i.id)}
            >
              {i.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:w-56">
            <label
              htmlFor="template-style"
              className="block text-[13px] font-medium text-slate-800"
            >
              Style
            </label>
            <select
              id="template-style"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className={`${inputClass} w-full py-2`}
            >
              <option value="all">All styles</option>
              {styleOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="template-search"
              className="block text-[13px] font-medium text-slate-800"
            >
              Search templates
            </label>
            <input
              id="template-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, e.g. Velvet"
              data-page-search
              className={`${inputClass} w-full py-2`}
            />
          </div>
        </div>
        <p className="text-[13px] font-medium text-slate-500" aria-live="polite">
          {filtered
            ? `Showing ${visible.length} of ${THEME_TEMPLATES.length} templates`
            : `${THEME_TEMPLATES.length} templates`}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">No templates match</p>
          <button
            type="button"
            onClick={() => {
              setLook('all');
              setIndustry('all');
              setStyle('all');
              setQuery('');
            }}
            className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              current={template.id === currentTemplate}
              previewHref={previewUrl(storefrontUrl, template.id)}
              formAction={applyAction ? formAction : undefined}
              storeId={storeId}
              owned={template.premium === null || owned.has(template.style)}
            />
          ))}
        </ul>
      )}

      {state && state !== dismissed && (state.success || state.error) ? (
        // Fixed so the result is visible wherever in the long list Apply was pressed.
        <div className="fixed inset-x-4 bottom-4 z-40 sm:left-auto sm:w-96">
          <div className="relative rounded-lg shadow-raised">
            <Alert tone={state.error ? 'error' : 'success'}>
              <span className="block pr-6">{state.error ?? state.success}</span>
            </Alert>
            <button
              type="button"
              onClick={() => setDismissed(state)}
              className="absolute top-2 right-2 rounded px-1.5 text-lg leading-none text-slate-500 hover:text-slate-900"
            >
              <span aria-hidden>×</span>
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function previewUrl(storefrontUrl: string, templateId: string): string {
  const url = new URL('/', storefrontUrl);
  url.searchParams.set(THEME_PREVIEW_PARAM, templateId);
  return url.toString();
}

function TemplateCard({
  template,
  current,
  previewHref,
  formAction,
  storeId,
  owned,
}: {
  template: ThemeTemplate;
  current: boolean;
  previewHref: string;
  formAction?: (formData: FormData) => void;
  storeId: string;
  /** Free, or a premium style this store has bought. */
  owned: boolean;
}) {
  return (
    <li
      // Off-screen cards skip layout and paint until scrolled near.
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 450px' }}
      className={`group/template flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-raised ${
        current ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-slate-200/90'
      }`}
    >
      <div className="border-b border-slate-100">
        <div aria-hidden className="flex items-center gap-1.5 bg-slate-100 px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        </div>
        <TemplateScreen template={template} height="19rem" />
      </div>
      <div className="flex flex-1 flex-col gap-1 px-4 pt-3 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold text-slate-900">{template.name}</h3>
          {current ? (
            <Badge tone="indigo">Current</Badge>
          ) : template.premium ? (
            <Badge tone={owned ? 'green' : 'yellow'}>
              {owned ? 'Owned' : `Premium · ${inr(template.premium.price)}`}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs font-medium text-slate-500">
          {template.industryLabel} · {template.styleLabel}
        </p>
        <p className="line-clamp-2 text-xs leading-5 text-slate-500">{template.description}</p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className={`${buttonClass('secondary', 'sm')} flex-1`}
          >
            Preview<span className="sr-only"> {template.name}</span>
          </a>
          {formAction && !owned && template.premium ? (
            <BuyButton
              storeId={storeId}
              styleId={template.style as PremiumStyleId}
              label={template.styleLabel}
              price={template.premium.price}
            />
          ) : formAction ? (
            <form action={formAction} className="flex flex-1">
              <input type="hidden" name="templateId" value={template.id} />
              <ApplyButton name={template.name} current={current} />
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}

interface OrderSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/** One-time purchase of a premium style through Razorpay Checkout (instant in development). */
function BuyButton({
  storeId,
  styleId,
  label,
  price,
}: {
  storeId: string;
  styleId: PremiumStyleId;
  label: string;
  price: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function buy() {
    setError(null);
    startTransition(async () => {
      const result = await buyTemplateAction(storeId, styleId);
      if ('error' in result) return setError(result.error);
      if ('owned' in result) return router.refresh();
      const { checkout } = result;
      try {
        await loadCheckout();
        const Razorpay = window.Razorpay;
        if (!Razorpay) throw new Error('Checkout unavailable');
        const instance = new Razorpay({
          key: checkout.keyId,
          order_id: checkout.orderId,
          amount: checkout.amount,
          currency: checkout.currency,
          name: checkout.name,
          description: checkout.description,
          prefill: { email: checkout.email },
          theme: { color: '#111111' },
          handler: (response: OrderSuccess) => {
            startTransition(async () => {
              const confirmed = await confirmTemplateAction(storeId, {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              if (confirmed.error) setError(confirmed.error);
              router.refresh();
            });
          },
        });
        instance.on('payment.failed', (response) => {
          setError(response.error?.description ?? 'The payment did not go through.');
        });
        instance.open();
      } catch {
        setError('Could not open the payment window. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <button
        type="button"
        onClick={buy}
        disabled={pending}
        aria-disabled={pending}
        className={`${buttonClass('primary', 'sm')} w-full`}
      >
        {pending ? 'Opening…' : `Buy ${inr(price)}`}
        <span className="sr-only"> the {label} premium template</span>
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ApplyButton({ name, current }: { name: string; current: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${buttonClass(current ? 'secondary' : 'primary', 'sm')} flex-1`}
    >
      {pending ? 'Applying…' : 'Apply'}
      <span className="sr-only"> {name}</span>
    </button>
  );
}
