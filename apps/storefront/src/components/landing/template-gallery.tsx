'use client';

import {
  THEME_INDUSTRIES,
  THEME_PREVIEW_PARAM,
  THEME_STYLES,
  THEME_TEMPLATES,
} from '@repo/contracts';
import { useDeferredValue, useEffect, useState } from 'react';
import { TemplateThumb } from './template-thumb';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const fieldClass = `w-full rounded-full border-0 bg-white px-4 py-2.5 text-sm text-slate-900 ring-1 ring-slate-300 ${focusRing}`;

/** Client-side filters (industry, style, search) over the full template catalog. */
export function TemplateGallery({
  initialIndustry,
  initialStyle,
  demoStoreUrl,
  signupUrl,
}: {
  initialIndustry: string;
  initialStyle: string;
  demoStoreUrl: string;
  signupUrl: string;
}) {
  const [industry, setIndustry] = useState(initialIndustry);
  const [style, setStyle] = useState(initialStyle);
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim().toLowerCase());

  // Keep the address shareable without a navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [key, value] of [
      ['industry', industry],
      ['style', style],
    ] as const) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, '', url);
  }, [industry, style]);

  const shown = THEME_TEMPLATES.filter(
    (t) =>
      (!industry || t.industry === industry) &&
      (!style || t.style === style) &&
      (!search ||
        `${t.name} ${t.industryLabel} ${t.styleLabel} ${t.description}`
          .toLowerCase()
          .includes(search)),
  );
  const clear = () => {
    setIndustry('');
    setStyle('');
    setQuery('');
  };

  return (
    <section aria-label="Template catalog" className="bg-slate-50 pb-24">
      <div className="sticky top-16 z-30 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-4 sm:px-6 lg:grid-cols-[14rem_14rem_1fr_auto] lg:items-center">
          <label>
            <span className="sr-only">Industry</span>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className={fieldClass}
            >
              <option value="">All industries</option>
              {THEME_INDUSTRIES.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Style</span>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className={fieldClass}>
              <option value="">All styles</option>
              {THEME_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 lg:col-span-1">
            <span className="sr-only">Search templates</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates"
              className={`${fieldClass} placeholder:text-slate-500`}
            />
          </label>
          <p aria-live="polite" className="col-span-2 text-sm text-slate-600 lg:col-span-1">
            {shown.length} {shown.length === 1 ? 'template' : 'templates'}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        <ul className="flex flex-wrap gap-2" aria-label="Industries">
          {[{ id: '', label: 'All' }, ...THEME_INDUSTRIES].map((i) => (
            <li key={i.id}>
              <button
                type="button"
                aria-pressed={industry === i.id}
                onClick={() => setIndustry(i.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${focusRing} ${
                  industry === i.id
                    ? 'bg-slate-950 text-white ring-slate-950'
                    : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-400'
                }`}
              >
                {i.label}
              </button>
            </li>
          ))}
        </ul>

        {shown.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-semibold text-slate-900">No templates match those filters.</p>
            <button
              type="button"
              onClick={clear}
              className={`mt-4 rounded text-sm font-semibold text-indigo-600 hover:text-indigo-500 ${focusRing}`}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <li key={t.id} className="flex flex-col">
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                  <TemplateThumb
                    template={t}
                    tiles={t.settings.gridColumns >= 4 ? 4 : 3}
                    className="h-64"
                  />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">{t.name}</h2>
                <p className="text-sm text-slate-500">
                  {t.industryLabel} · {t.styleLabel}
                </p>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{t.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`${demoStoreUrl}/?${THEME_PREVIEW_PARAM}=${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-full px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 hover:bg-white ${focusRing}`}
                  >
                    Preview<span className="sr-only"> {t.name} (opens in a new tab)</span>
                  </a>
                  <a
                    href={`${signupUrl}?template=${t.id}`}
                    className={`rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 ${focusRing}`}
                  >
                    Start with this template<span className="sr-only">: {t.name}</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-16 text-center text-sm text-slate-600">
          Pick one when you create your store, and switch any time from your admin.
        </p>
      </div>
    </section>
  );
}
