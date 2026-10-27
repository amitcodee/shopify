'use client';

/* eslint-disable @next/next/no-img-element -- static same-origin photos with explicit sizes; next/image adds nothing here. */
import { THEME_INDUSTRIES, THEME_STYLES, THEME_TEMPLATES } from '@repo/contracts';
import { useDeferredValue, useEffect, useState } from 'react';
import { industryPhoto } from './photos';
import { TemplateCard } from './template-card';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-600';

const perIndustry = THEME_STYLES.length;
const PAGE = 24;

/** Client-side filters (industry chips, style pills, search) over the full template catalog. */
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
  // Rendered a page at a time (every card is a full miniature store); new filters start over.
  const filterKey = `${industry}|${style}|${search}`;
  const [more, setMore] = useState({ key: filterKey, count: PAGE });
  const count = more.key === filterKey ? more.count : PAGE;
  const clear = () => {
    setIndustry('');
    setStyle('');
    setQuery('');
  };

  return (
    <section aria-label="Template catalog" className="bg-white pb-24">
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <h2 className="text-sm font-semibold text-navy-900">Shop by industry</h2>
        <ul
          className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-3 sm:gap-5 lg:mx-0 lg:justify-between lg:overflow-visible lg:px-0"
          aria-label="Industries"
        >
          {[{ id: '', label: 'All' }, ...THEME_INDUSTRIES].map((i) => {
            const active = industry === i.id;
            return (
              <li key={i.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setIndustry(i.id)}
                  className={`group flex w-[4.75rem] flex-col items-center gap-2 rounded-2xl text-center ${focusRing}`}
                >
                  <span
                    className={`grid size-16 place-items-center overflow-hidden rounded-full ring-offset-2 transition ${
                      active
                        ? 'ring-2 ring-navy-950'
                        : 'ring-1 ring-slate-900/10 group-hover:ring-slate-900/40'
                    } ${i.id ? 'bg-slate-100' : 'bg-navy-950 text-white'}`}
                  >
                    {i.id ? (
                      <img
                        src={industryPhoto(i.id)}
                        alt=""
                        width={128}
                        height={128}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                        className="size-6"
                      >
                        <path d="M3 4.25C3 3.56 3.56 3 4.25 3h3.5C8.44 3 9 3.56 9 4.25v3.5C9 8.44 8.44 9 7.75 9h-3.5C3.56 9 3 8.44 3 7.75v-3.5Zm8 0c0-.69.56-1.25 1.25-1.25h3.5c.69 0 1.25.56 1.25 1.25v3.5c0 .69-.56 1.25-1.25 1.25h-3.5C11.56 9 11 8.44 11 7.75v-3.5Zm-8 8c0-.69.56-1.25 1.25-1.25h3.5c.69 0 1.25.56 1.25 1.25v3.5C9 16.44 8.44 17 7.75 17h-3.5C3.56 17 3 16.44 3 15.75v-3.5Zm8 0c0-.69.56-1.25 1.25-1.25h3.5c.69 0 1.25.56 1.25 1.25v3.5c0 .69-.56 1.25-1.25 1.25h-3.5c-.69 0-1.25-.56-1.25-1.25v-3.5Z" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`text-xs leading-tight ${active ? 'font-semibold text-navy-950' : 'font-medium text-slate-700'}`}
                  >
                    {i.id ? i.label.split(' & ')[0] : 'All'}
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                      {i.id ? perIndustry : THEME_TEMPLATES.length} templates
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky top-16 z-30 mt-6 border-y border-slate-900/[0.07] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <ul
            aria-label="Styles"
            className="-mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_88%,transparent)] pr-10 lg:mx-0 lg:pl-0 [&::-webkit-scrollbar]:hidden"
          >
            {[{ id: '', label: 'All styles' }, ...THEME_STYLES].map((st) => (
              <li key={st.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={style === st.id}
                  onClick={() => setStyle(st.id)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${focusRing} ${
                    style === st.id
                      ? 'bg-navy-950 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <label className="relative flex-1 lg:w-72 lg:flex-none">
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
                className={`w-full rounded-full border-0 bg-slate-100 py-2 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-500 focus:bg-white focus:ring-1 focus:ring-slate-900/20 ${focusRing}`}
              />
            </label>
            <p aria-live="polite" className="shrink-0 text-sm font-medium text-slate-600">
              {shown.length} {shown.length === 1 ? 'template' : 'templates'}
            </p>
          </div>
        </div>
      </div>

<<<<<<< Updated upstream
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <ul
          className="-mx-4 flex gap-2 overflow-x-auto [scrollbar-width:none] px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
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

=======
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
>>>>>>> Stashed changes
        {shown.length === 0 ? (
          <div className="rounded-[1.75rem] bg-slate-50 py-24 text-center">
            <p className="text-lg font-semibold text-navy-900">No templates match those filters.</p>
            <button
              type="button"
              onClick={clear}
              className={`mt-4 rounded-full bg-navy-950 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-900 ${focusRing}`}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {shown.slice(0, count).map((t) => (
                <li key={t.id}>
                  <TemplateCard template={t} demoStoreUrl={demoStoreUrl} signupUrl={signupUrl} />
                </li>
              ))}
            </ul>
            {shown.length > count ? (
              <div className="mt-14 flex flex-col items-center gap-3">
                <p className="text-sm text-slate-500">
                  Showing {count} of {shown.length}
                </p>
                <button
                  type="button"
                  onClick={() => setMore({ key: filterKey, count: count + PAGE })}
                  className={`rounded-full bg-navy-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-900 ${focusRing}`}
                >
                  Show more templates
                </button>
              </div>
            ) : null}
          </>
        )}
        <p className="mt-20 text-center text-sm text-slate-600">
          Pick one when you create your store, and switch any time from your admin.
        </p>
      </div>
    </section>
  );
}
