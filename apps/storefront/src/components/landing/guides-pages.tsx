import { findFeatureArea } from './features-data';
import { GUIDES, type Guide } from './guides-data';
import { Icon } from './icons';
import { container, CtaBand, focusRing, PageHero, SectionHeading, textLink } from './page-parts';

const CATEGORIES: Guide['category'][] = [
  'Getting started',
  'Selling',
  'Running your store',
  'Advanced',
];

function GuideCard({ guide }: { guide: Guide }) {
  return (
    <a
      href={`/guides/${guide.slug}`}
      className={`group flex h-full gap-4 rounded-2xl bg-white p-6 ring-1 ring-slate-200 transition hover:shadow-lg hover:ring-indigo-200 ${focusRing}`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        <Icon name={guide.icon} />
      </span>
      <span>
        <span className="block font-semibold text-slate-900 group-hover:text-indigo-700">
          {guide.title}
        </span>
        <span className="mt-1 block text-sm leading-6 text-slate-600">{guide.summary}</span>
        <span className="mt-2 block text-xs text-slate-500">
          {guide.steps.length} steps · {guide.where}
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
        center
        eyebrow="Guides"
        title="Step-by-step help for your store"
        subtitle="Short, practical guides that follow your admin screen by screen — from creating your store to connecting your own systems."
      />
      {CATEGORIES.map((category, i) => {
        const guides = GUIDES.filter((g) => g.category === category);
        if (guides.length === 0) return null;
        return (
          <section
            key={category}
            aria-labelledby={`cat-${i}`}
            className={`py-16 sm:py-20 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}
          >
            <div className={container}>
              <SectionHeading id={`cat-${i}`} title={category} />
              <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
      <section className="py-16">
        <div className={`${container} text-center text-slate-600`}>
          Can’t find what you need?{' '}
          <a href="/contact" className={textLink}>
            Contact support
          </a>{' '}
          or read the{' '}
          <a href="/pricing#faq" className={textLink}>
            FAQ
          </a>
          .
        </div>
      </section>
    </>
  );
}

/** `/guides/[slug]`: one guide. */
export function GuidePage({ guide }: { guide: Guide }) {
  const index = GUIDES.indexOf(guide);
  const next = GUIDES[index + 1];
  const others = GUIDES.filter((g) => g.category === guide.category && g !== guide).slice(0, 3);
  const features = guide.features.map(findFeatureArea).filter((a) => !!a);
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Guides', href: '/guides' }, { label: guide.title }]}
        eyebrow={guide.category}
        title={guide.title}
        subtitle={guide.intro}
      />
      <section className="py-16 sm:py-20">
        <div className={`${container} grid gap-12 lg:grid-cols-[1fr_18rem]`}>
          <article className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              <Icon name="layout" className="size-4 text-indigo-600" />
              In your admin: <span className="font-semibold">{guide.where}</span>
            </p>
            <h2 className="sr-only">Steps</h2>
            <ol className="mt-10 space-y-10">
              {guide.steps.map((step, i) => (
                <li key={step.title} className="relative flex gap-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-1.5">
                    <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-2 leading-7 text-slate-700">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {guide.tips && guide.tips.length > 0 ? (
              <aside
                aria-labelledby="tips"
                className="mt-12 rounded-2xl bg-indigo-50 p-6 ring-1 ring-indigo-100"
              >
                <h2 id="tips" className="font-semibold text-indigo-900">
                  Good to know
                </h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-indigo-950/80">
                  {guide.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </aside>
            ) : null}
            {next ? (
              <a
                href={`/guides/${next.slug}`}
                className={`mt-12 flex items-center justify-between gap-4 rounded-2xl p-6 ring-1 ring-slate-200 hover:ring-indigo-300 ${focusRing}`}
              >
                <span>
                  <span className="block text-sm text-slate-500">Next guide</span>
                  <span className="block font-semibold text-slate-900">{next.title}</span>
                </span>
                <span aria-hidden="true" className="text-xl text-indigo-600">
                  →
                </span>
              </a>
            ) : null}
          </article>
          <aside aria-label="Related" className="space-y-8 lg:sticky lg:top-24 lg:self-start">
            {features.length > 0 ? (
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Related features</h2>
                <ul className="mt-3 space-y-2">
                  {features.map((a) => (
                    <li key={a.slug}>
                      <a
                        href={`/features/${a.slug}`}
                        className={`flex items-center gap-2 rounded text-sm text-slate-600 hover:text-indigo-600 ${focusRing}`}
                      >
                        <Icon name={a.icon} className="size-4 text-indigo-600" />
                        {a.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {others.length > 0 ? (
              <div>
                <h2 className="text-sm font-semibold text-slate-900">More in {guide.category}</h2>
                <ul className="mt-3 space-y-2">
                  {others.map((g) => (
                    <li key={g.slug}>
                      <a
                        href={`/guides/${g.slug}`}
                        className={`rounded text-sm text-slate-600 hover:text-indigo-600 ${focusRing}`}
                      >
                        {g.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Still stuck?</h2>
              <p className="mt-1 text-sm text-slate-600">Our support team can help.</p>
              <a href="/contact" className={`mt-3 inline-block text-sm ${textLink}`}>
                Contact support →
              </a>
            </div>
          </aside>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
