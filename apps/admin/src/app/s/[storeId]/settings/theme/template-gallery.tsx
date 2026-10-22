'use client';

import {
  THEME_INDUSTRIES,
  THEME_PREVIEW_PARAM,
  THEME_STYLES,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import { useActionState, useDeferredValue, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Badge, buttonClass } from '@/components/ui';
import type { FormState } from '@/lib/form';
import { TemplateThumbnail } from './template-thumbnail';

type ApplyAction = (state: FormState, formData: FormData) => Promise<FormState>;

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
    active
      ? 'bg-indigo-600 text-white ring-indigo-600'
      : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
  }`;

/** Filterable template catalog. Filtering runs in the browser over the bundled catalog. */
export function TemplateGallery({
  currentTemplate,
  storefrontUrl,
  applyAction,
}: {
  currentTemplate: string;
  storefrontUrl: string;
  /** Present only for staff who can edit the theme. */
  applyAction?: ApplyAction;
}) {
  const [industry, setIndustry] = useState('all');
  const [style, setStyle] = useState('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [state, formAction] = useActionState(
    applyAction ?? (async () => undefined),
    undefined as FormState,
  );
  const [dismissed, setDismissed] = useState<FormState>(undefined);

  const needle = deferredQuery.trim().toLowerCase();
  const visible = THEME_TEMPLATES.filter(
    (t) =>
      (industry === 'all' || t.industry === industry) &&
      (style === 'all' || t.style === style) &&
      (!needle || t.name.toLowerCase().includes(needle)),
  );
  const filtered = industry !== 'all' || style !== 'all' || needle !== '';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div
          role="group"
          aria-label="Industry"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
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
          <div className="space-y-1 sm:w-56">
            <label htmlFor="template-style" className="block text-sm font-medium text-slate-700">
              Style
            </label>
            <select
              id="template-style"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            >
              <option value="all">All styles</option>
              {THEME_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="template-search" className="block text-sm font-medium text-slate-700">
              Search templates
            </label>
            <input
              id="template-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, e.g. Velvet"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            />
          </div>
        </div>
        <p className="text-sm text-slate-500" aria-live="polite">
          {filtered
            ? `Showing ${visible.length} of ${THEME_TEMPLATES.length} templates`
            : `${THEME_TEMPLATES.length} templates`}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">No templates match</p>
          <button
            type="button"
            onClick={() => {
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
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              current={template.id === currentTemplate}
              previewHref={previewUrl(storefrontUrl, template.id)}
              formAction={applyAction ? formAction : undefined}
            />
          ))}
        </ul>
      )}

      {state && state !== dismissed && (state.success || state.error) ? (
        // Fixed so the result is visible wherever in the long list Apply was pressed.
        <div className="fixed inset-x-4 bottom-4 z-20 sm:left-auto sm:w-96">
          <div className="relative shadow-lg">
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
}: {
  template: ThemeTemplate;
  current: boolean;
  previewHref: string;
  formAction?: (formData: FormData) => void;
}) {
  return (
    <li
      // Off-screen cards skip layout and paint until scrolled near.
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 390px' }}
      className={`flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white shadow-sm ${
        current ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-200'
      }`}
    >
      <div className="border-b border-slate-100">
        <TemplateThumbnail
          preset={template.preset}
          settings={template.settings}
          storeName={template.name}
          heroTitle={template.sample.heroTitle}
          announcement={template.sample.announcement}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900">{template.name}</h3>
          {current ? <Badge tone="indigo">Current</Badge> : null}
        </div>
        <p className="text-xs font-medium text-slate-500">
          {template.industryLabel} · {template.styleLabel}
        </p>
        <p className="text-xs text-slate-500">{template.description}</p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className={`${buttonClass('secondary')} flex-1`}
          >
            Preview<span className="sr-only"> {template.name}</span>
          </a>
          {formAction ? (
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

function ApplyButton({ name, current }: { name: string; current: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${buttonClass(current ? 'secondary' : 'primary')} flex-1`}
    >
      {pending ? 'Applying…' : 'Apply'}
      <span className="sr-only"> {name}</span>
    </button>
  );
}
