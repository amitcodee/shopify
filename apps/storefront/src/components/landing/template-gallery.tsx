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
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-600';
const fieldClass = `w-full rounded-full border-0 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-slate-900/15 ${focusRing}`;

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
    <section aria-label="Template catalog" className="bg-white pb-24">
      <div className="sticky top-16 z-30 border-y border-slate-900/[0.08] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-3.5 sm:px-6 lg:grid-cols-[13rem_13rem_1fr_auto] lg:items-center lg:px-8">
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
          <label className="relative col-span-2 lg:col-span-1">
            <span className="sr-only">Search templates</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates"
              className={`${fieldClass} pl-10 placeholder:text-slate-500`}
            />
          </label>
          <p
            aria-live="polite"
            className="col-span-2 text-sm font-medium text-slate-600 lg:col-span-1"
          >
            {shown.length} {shown.length === 1 ? 'template' : 'templates'}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <ul
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          aria-label="Industries"
        >
          {[{ id: '', label: 'All' }, ...THEME_INDUSTRIES].map((i) => (
            <li key={i.id} className="shrink-0">
              <button
                type="button"
                aria-pressed={industry === i.id}
                onClick={() => setIndustry(i.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${focusRing} ${
                  industry === i.id
                    ? 'bg-navy-950 text-white ring-slate-950'
                    : 'bg-white text-slate-700 ring-slate-900/15 hover:ring-slate-900/40'
                }`}
              >
                {i.label}
              </button>
            </li>
          ))}
        </ul>

        {shown.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-lg font-semibold text-navy-900">No templates match those filters.</p>
            <button
              type="button"
              onClick={clear}
              className={`mt-4 rounded-full px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-900/15 hover:ring-slate-900/40 ${focusRing}`}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="mt-10 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <li key={t.id} className="flex flex-col">
                <a href={`/templates/${t.id}`} className={`group block rounded-2xl ${focusRing}`}>
                  <div className="overflow-hidden rounded-2xl bg-mist p-2.5 ring-1 ring-slate-900/[0.07] transition duration-300 group-hover:shadow-[0_24px_48px_-24px_rgb(15_23_42/0.45)]">
                    <div className="overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-900/10">
                      <TemplateThumb
                        template={t}
                        tiles={t.settings.gridColumns >= 4 ? 4 : 3}
                        scale={9}
                        className="h-72 transition duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight text-navy-900 group-hover:text-azure-700">
                      {t.name}
                    </h2>
                    <span aria-hidden="true" className="mt-1.5 flex -space-x-1">
                      {[
                        t.settings.brandColor,
                        t.settings.accentColor,
                        t.settings.backgroundColor,
                      ].map((c, i) => (
                        <span
                          key={i}
                          className="size-4 rounded-full ring-2 ring-white"
                          style={{ background: c, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)' }}
                        />
                      ))}
                    </span>
                  </div>
                </a>
                <p className="text-sm text-slate-500">
                  {t.industryLabel} · {t.styleLabel}
                </p>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{t.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`${signupUrl}?template=${t.id}`}
                    className={`rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-azure-700 ${focusRing}`}
                  >
                    Start with this template<span className="sr-only">: {t.name}</span>
                  </a>
                  <a
                    href={`${demoStoreUrl}/?${THEME_PREVIEW_PARAM}=${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-full px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-900/15 transition hover:ring-slate-900/40 ${focusRing}`}
                  >
                    Preview<span className="sr-only"> {t.name} (opens in a new tab)</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-20 text-center text-sm text-slate-600">
          Pick one when you create your store, and switch any time from your admin.
        </p>
      </div>
    </section>
  );
}
