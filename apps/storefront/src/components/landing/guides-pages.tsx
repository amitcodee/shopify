import { findFeatureArea } from './features-data';
import { GUIDES, type Guide } from './guides-data';
import { Icon, type IconName } from './icons';
import {
  Arrow,
  Breadcrumbs,
  container,
  CtaBand,
  display,
  Eyebrow,
  focusRing,
  IconTile,
  lead,
  PageHero,
  paper,
  PhotoPanel,
  SectionHeading,
  textLink,
} from './page-parts';

const CATEGORIES: { name: Guide['category']; icon: IconName; blurb: string }[] = [
  { name: 'Getting started', icon: 'rocket', blurb: 'Create your store, add products, get paid.' },
  { name: 'Selling', icon: 'tag', blurb: 'Shipping, taxes, templates, domains, discounts.' },
  { name: 'Running your store', icon: 'truck', blurb: 'Orders, refunds, currencies and staff.' },
  { name: 'Advanced', icon: 'code', blurb: 'API tokens, webhooks and integrations.' },
];

const categoryId = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-');

function GuideCard({ guide }: { guide: Guide }) {
  return (
    <a
      href={`/guides/${guide.slug}`}
      className={`group flex h-full gap-5 rounded-[1.5rem] bg-white p-6 ring-1 ring-slate-900/[0.08] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgb(15_23_42/0.4)] sm:p-7 ${focusRing}`}
    >
      <IconTile name={guide.icon} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-semibold tracking-tight text-slate-950 group-hover:text-indigo-700">
          {guide.title}
        </span>
        <span className="mt-1.5 text-[0.9375rem] leading-7 text-slate-600">{guide.summary}</span>
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
            {guide.steps.length} steps
          </span>
          <span className="truncate">{guide.where}</span>
        </span>
      </span>
    </a>
  );
}

/** `/guides`: the help center. */
export function GuidesHub() {
  return (
    <>
      <PageHero
        eyebrow="Help center"
        title="Step-by-step help for your store"
        subtitle="Short, practical guides that follow your admin screen by screen — from creating your store to connecting your own systems."
        aside={
          <PhotoPanel
            photo="product-photography"
            priority
            ratio="aspect-[5/4]"
            position="center 35%"
          />
        }
      />
      <nav aria-label="Guide categories" className="bg-white pt-16 sm:pt-20">
        <ul className={`${container} grid gap-4 sm:grid-cols-2 lg:grid-cols-4`}>
          {CATEGORIES.map((c) => (
            <li key={c.name}>
              <a
                href={`#${categoryId(c.name)}`}
                className={`group flex h-full flex-col rounded-[1.5rem] bg-[#f6f4ef] p-6 ring-1 ring-slate-900/[0.06] transition hover:bg-white hover:shadow-[0_20px_40px_-24px_rgb(15_23_42/0.4)] ${focusRing}`}
              >
                <IconTile name={c.icon} />
                <span className="mt-5 font-semibold text-slate-950">{c.name}</span>
                <span className="mt-1 text-sm leading-6 text-slate-600">{c.blurb}</span>
                <span className="mt-auto pt-4 text-xs font-semibold text-indigo-700">
                  {GUIDES.filter((g) => g.category === c.name).length} guides
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {CATEGORIES.map(({ name }, i) => {
        const guides = GUIDES.filter((g) => g.category === name);
        if (guides.length === 0) return null;
        return (
          <section
            key={name}
            id={categoryId(name)}
            aria-labelledby={`cat-${i}`}
            className="scroll-mt-20 bg-white pt-16 sm:pt-20"
          >
            <div className={container}>
              <div className="border-t border-slate-900/[0.08] pt-10">
                <SectionHeading id={`cat-${i}`} title={name} size="md" />
              </div>
              <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <GuideCard guide={g} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
      <section className="bg-white py-20 sm:py-24">
        <div className={container}>
          <div className="flex flex-col items-start justify-between gap-6 rounded-[1.75rem] bg-[#f6f4ef] p-8 ring-1 ring-slate-900/[0.06] sm:flex-row sm:items-center sm:p-10">
            <div className="flex gap-5">
              <IconTile name="mail" className="hidden sm:flex" />
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Can’t find what you need?
                </h2>
                <p className="mt-1 leading-7 text-slate-600">
                  Our support team can help, and the FAQ covers fees, domains and security.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <a href="/contact" className={`group inline-flex items-center gap-1 ${textLink}`}>
                Contact support <Arrow />
              </a>
              <a href="/pricing#faq" className={`group inline-flex items-center gap-1 ${textLink}`}>
                Read the FAQ <Arrow />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** `/guides/[slug]`: one guide, laid out like a help-center article. */
export function GuidePage({ guide }: { guide: Guide }) {
  const index = GUIDES.indexOf(guide);
  const prev = GUIDES[index - 1];
  const next = GUIDES[index + 1];
  const features = guide.features.map(findFeatureArea).filter((a) => !!a);
  const sideLink = (active: boolean) =>
    `block rounded-lg px-3 py-1.5 text-sm transition ${focusRing} ${
      active
        ? 'bg-white font-semibold text-slate-950 shadow-sm ring-1 ring-slate-900/10'
        : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
    }`;
  return (
    <>
      <section className={`relative isolate overflow-hidden ${paper}`}>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(40rem_22rem_at_90%_-10%,rgb(99_102_241/0.12),transparent)]"
        />
        <div className={`${container} pt-10 pb-14 sm:pt-14 sm:pb-16`}>
          <Breadcrumbs items={[{ label: 'Guides', href: '/guides' }, { label: guide.title }]} />
          <div className="mt-8 max-w-3xl">
            <Eyebrow>{guide.category}</Eyebrow>
            <h1 className={`mt-5 text-slate-950 ${display}`}>{guide.title}</h1>
            <p className={`mt-6 text-slate-600 ${lead}`}>{guide.intro}</p>
            <p className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-900/10">
                <Icon name="stack" className="size-4 text-indigo-600" />
                {guide.steps.length} steps
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-900/10">
                <Icon name="layout" className="size-4 text-indigo-600" />
                In your admin: <span className="font-semibold text-slate-900">{guide.where}</span>
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20">
        <div
          className={`${container} grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_15rem] xl:gap-14`}
        >
          {/* All guides */}
          <nav
            aria-label="All guides"
            className="hidden self-start rounded-[1.5rem] bg-[#f6f4ef] p-4 ring-1 ring-slate-900/[0.06] lg:sticky lg:top-24 lg:block"
          >
            {CATEGORIES.map(({ name }) => (
              <div key={name} className="mt-4 first:mt-0">
                <p className="px-3 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  {name}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {GUIDES.filter((g) => g.category === name).map((g) => (
                    <li key={g.slug}>
                      <a
                        href={`/guides/${g.slug}`}
                        aria-current={g === guide ? 'page' : undefined}
                        className={sideLink(g === guide)}
                      >
                        {g.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <article className="min-w-0">
            <h2 className="sr-only">Steps</h2>
            <ol className="relative">
              {guide.steps.map((step, i) => (
                <li
                  key={step.title}
                  id={`step-${i + 1}`}
                  className="relative flex scroll-mt-24 gap-5 pb-10 last:pb-0 sm:gap-6"
                >
                  {i < guide.steps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-12 bottom-2 left-5 w-px bg-slate-900/10"
                    />
                  ) : null}
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white shadow-[0_0_0_6px_white]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-1.5">
                    <h3 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
                      {step.title}
                    </h3>
                    <p className="mt-2.5 text-[1.0625rem] leading-8 text-slate-700">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {guide.tips && guide.tips.length > 0 ? (
              <aside
                aria-labelledby="tips"
                className="mt-14 rounded-[1.5rem] border-l-4 border-indigo-500 bg-indigo-50/70 p-6 sm:p-7"
              >
                <h2 id="tips" className="flex items-center gap-2 font-semibold text-indigo-950">
                  <Icon name="shield" className="size-5 text-indigo-600" />
                  Good to know
                </h2>
                <ul className="mt-4 space-y-3 text-indigo-950/80">
                  {guide.tips.map((tip) => (
                    <li key={tip} className="flex gap-3 leading-7">
                      <span
                        aria-hidden="true"
                        className="mt-3 size-1.5 shrink-0 rounded-full bg-indigo-400"
                      />
                      {tip}
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
            <div className="mt-14 grid gap-4 sm:grid-cols-2">
              {prev ? (
                <a
                  href={`/guides/${prev.slug}`}
                  className={`group rounded-[1.25rem] p-5 ring-1 ring-slate-900/10 transition hover:bg-[#f6f4ef] ${focusRing}`}
                >
                  <span className="block text-sm text-slate-500">
                    <span aria-hidden="true">← </span>Previous guide
                  </span>
                  <span className="mt-1 block font-semibold text-slate-950">{prev.title}</span>
                </a>
              ) : (
                <span className="hidden sm:block" />
              )}
              {next ? (
                <a
                  href={`/guides/${next.slug}`}
                  className={`group rounded-[1.25rem] p-5 text-right ring-1 ring-slate-900/10 transition hover:bg-[#f6f4ef] ${focusRing}`}
                >
                  <span className="block text-sm text-slate-500">
                    Next guide<span aria-hidden="true"> →</span>
                  </span>
                  <span className="mt-1 block font-semibold text-slate-950">{next.title}</span>
                </a>
              ) : null}
            </div>
          </article>

          <aside
            aria-label="Related"
            className="space-y-8 lg:col-start-2 xl:sticky xl:top-24 xl:col-start-3 xl:self-start"
          >
            <div className="hidden xl:block">
              <h2 className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                On this page
              </h2>
              <ol className="mt-3 space-y-1 border-l border-slate-900/10">
                {guide.steps.map((step, i) => (
                  <li key={step.title}>
                    <a
                      href={`#step-${i + 1}`}
                      className={`-ml-px block border-l border-transparent py-1 pl-4 text-sm text-slate-600 hover:border-slate-950 hover:text-slate-950 ${focusRing}`}
                    >
                      {step.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            {features.length > 0 ? (
              <div>
                <h2 className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Related features
                </h2>
                <ul className="mt-3 space-y-2">
                  {features.map((a) => (
                    <li key={a.slug}>
                      <a
                        href={`/features/${a.slug}`}
                        className={`flex items-center gap-2 rounded text-sm font-medium text-slate-700 hover:text-indigo-700 ${focusRing}`}
                      >
                        <Icon name={a.icon} className="size-4 text-indigo-600" />
                        {a.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="rounded-[1.25rem] bg-[#f6f4ef] p-5 ring-1 ring-slate-900/[0.06]">
              <h2 className="text-sm font-semibold text-slate-950">Still stuck?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Our support team can help.</p>
              <a
                href="/contact"
                className={`group mt-3 inline-flex items-center gap-1 text-sm ${textLink}`}
              >
                Contact support <Arrow />
              </a>
            </div>
          </aside>
        </div>
      </section>
      <CtaBand photo="packing-orders" />
    </>
  );
}
