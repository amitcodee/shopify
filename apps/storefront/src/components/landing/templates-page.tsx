import {
  findThemeTemplate,
  THEME_INDUSTRIES,
  THEME_STYLES,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import { container, display, Eyebrow, focusRing, lead, paper } from './page-parts';
import { templateTint } from './template-card';
import { TemplateGallery } from './template-gallery';
import { TemplateThumb } from './template-thumb';
import { demoStoreUrl, signupUrl } from './urls';

/** One tile of the hero bento: a pastel panel with a template peeking out of it. */
function BentoTile({ template: t, big = false }: { template: ThemeTemplate; big?: boolean }) {
  return (
    <a
      href={`/templates/${t.id}`}
      className={`group relative flex flex-col overflow-hidden rounded-[1.75rem] ring-1 ring-slate-900/[0.06] ${focusRing} ${
        big ? 'row-span-2' : ''
      }`}
      style={{ background: templateTint(t, 22) }}
    >
      <span className="flex items-center justify-between gap-2 px-5 pt-4">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-navy-950">{t.name}</span>
          <span className="block truncate text-xs text-slate-600">
            {t.industryLabel} · {t.styleLabel}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-navy-950 shadow-sm transition group-hover:rotate-45"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path d="M6.2 4.5a.75.75 0 0 1 .75-.75h8.55a.75.75 0 0 1 .75.75v8.55a.75.75 0 0 1-1.5 0V6.31l-9.47 9.47a.75.75 0 1 1-1.06-1.06l9.47-9.47H6.95a.75.75 0 0 1-.75-.75Z" />
          </svg>
        </span>
      </span>
      <span className="relative mt-4 ml-5 flex-1 overflow-hidden rounded-tl-2xl shadow-[0_20px_40px_-20px_rgb(15_23_42/0.5)] ring-1 ring-slate-900/10">
        <TemplateThumb
          template={t}
          tiles={3}
          scale={big ? 8 : 6}
          priority
          className={`absolute inset-0 ${big ? "" : "w-[150%]"} transition duration-700 group-hover:-translate-y-3`}
        />
      </span>
    </a>
  );
}

/** The public template store; `industry` / `style` preselect filters (unknown ids are ignored). */
export function TemplatesPage({ industry, style }: { industry: string; style: string }) {
  const bento = ['fashion-luxe', 'food-fresh', 'electronics-market']
    .map(findThemeTemplate)
    .filter((t): t is ThemeTemplate => !!t);
  return (
    <>
      <section className={`relative isolate overflow-hidden ${paper}`}>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(44rem_26rem_at_90%_0%,rgb(48_94_255/0.12),transparent)]"
        />
        <div
          className={`${container} grid items-center gap-12 pt-12 pb-14 sm:pt-16 lg:grid-cols-[1fr_1.15fr] lg:pt-20 lg:pb-20`}
        >
          <div className="max-w-xl">
            <Eyebrow>Template store</Eyebrow>
            <h1 className={`mt-5 text-navy-900 ${display}`}>Templates for every kind of store</h1>
            <p className={`mt-6 text-slate-600 ${lead}`}>
              Preview any template on a live demo store, then start your store with the one you
              like. Colors, fonts and layout stay editable, and you can switch any time.
            </p>
            <dl className="mt-10 flex gap-10">
              {[
                [THEME_TEMPLATES.length, 'templates'],
                [THEME_INDUSTRIES.length, 'industries'],
                [THEME_STYLES.length, 'design styles'],
              ].map(([n, label]) => (
                <div key={label} className="flex flex-col">
                  <dt className="order-2 text-sm text-slate-600">{label}</dt>
                  <dd className="order-1 text-3xl font-semibold tracking-tight text-navy-950">
                    {n}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="hidden h-[30rem] grid-cols-[1.15fr_1fr] grid-rows-2 gap-4 sm:grid">
            {bento.map((t, i) => (
              <BentoTile key={t.id} template={t} big={i === 0} />
            ))}
          </div>
        </div>
      </section>
      <TemplateGallery
        initialIndustry={THEME_INDUSTRIES.some((i) => i.id === industry) ? industry : ''}
        initialStyle={THEME_STYLES.some((s) => s.id === style) ? style : ''}
        demoStoreUrl={demoStoreUrl}
        signupUrl={signupUrl}
      />
    </>
  );
}
