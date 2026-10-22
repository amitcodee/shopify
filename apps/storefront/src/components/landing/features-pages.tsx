/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import { FEATURE_AREAS, type FeatureArea, findFeatureArea } from './features-data';
import { findGuide } from './guides-data';
import { Icon } from './icons';
import { FeatureMock } from './mocks';
import {
  buttonGhostDark,
  buttonLight,
  CheckList,
  container,
  CtaBand,
  focusRing,
  IconGrid,
  PageHero,
  SectionHeading,
  Steps,
} from './page-parts';
import { signupUrl } from './urls';

/** Feature areas grouped the way the hub and menus present them. */
export const FEATURE_GROUPS: { title: string; slugs: string[] }[] = [
  { title: 'Build your store', slugs: ['online-store', 'domains', 'international'] },
  { title: 'Sell and get paid', slugs: ['checkout', 'payments', 'marketing'] },
  { title: 'Run your business', slugs: ['inventory', 'orders', 'analytics'] },
  { title: 'Grow with confidence', slugs: ['staff-security', 'developers'] },
];

const areas = (slugs: string[]) => slugs.map(findFeatureArea).filter((a): a is FeatureArea => !!a);

/** `/features`: every feature area, grouped, linking to its page. */
export function FeaturesHub() {
  return (
    <>
      <PageHero
        center
        eyebrow="Features"
        title="Everything you need to sell online, in one place"
        subtitle="A storefront, checkout and back office that work together from day one. Every feature is included on every plan."
        actions={
          <>
            <a href={signupUrl} className={buttonLight}>
              Start for free
            </a>
            <a href="/pricing" className={buttonGhostDark}>
              See pricing
            </a>
          </>
        }
      />
      <nav aria-label="Feature areas" className="border-b border-slate-200 bg-white">
        <ul className={`${container} flex gap-2 overflow-x-auto py-4`}>
          {FEATURE_AREAS.map((a) => (
            <li key={a.slug} className="shrink-0">
              <a
                href={`/features/${a.slug}`}
                className={`flex items-center gap-2 rounded-full bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-white hover:ring-indigo-300 ${focusRing}`}
              >
                <Icon name={a.icon} className="size-4 text-indigo-600" />
                {a.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {FEATURE_GROUPS.map((group, i) => (
        <section
          key={group.title}
          aria-labelledby={`group-${i}`}
          className={`py-20 sm:py-24 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={container}>
            <SectionHeading id={`group-${i}`} title={group.title} />
            <div className="mt-10">
              <IconGrid
                items={areas(group.slugs).map((a) => ({
                  icon: a.icon,
                  title: a.name,
                  body: a.summary,
                  href: `/features/${a.slug}`,
                }))}
              />
            </div>
          </div>
        </section>
      ))}
      <CtaBand />
    </>
  );
}

/** `/features/[slug]`: one feature area. */
export function FeaturePage({ area }: { area: FeatureArea }) {
  const related = areas(area.related);
  const guides = area.guides.map(findGuide).filter((g) => !!g);
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Features', href: '/features' }, { label: area.name }]}
        eyebrow={area.eyebrow}
        title={area.headline}
        subtitle={area.subhead}
        actions={
          <>
            <a href={signupUrl} className={buttonLight}>
              Start for free
            </a>
            {guides[0] ? (
              <a href={`/guides/${guides[0].slug}`} className={buttonGhostDark}>
                Read the guide
              </a>
            ) : (
              <a href="/features" className={buttonGhostDark}>
                All features
              </a>
            )}
          </>
        }
        aside={
          <ul className="grid gap-3 sm:grid-cols-2">
            {area.capabilities.map((c) => (
              <li
                key={c.title}
                className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-200">
                  <Icon name={c.icon} className="size-4.5" />
                </span>
                <span className="text-sm font-medium text-slate-100">{c.title}</span>
              </li>
            ))}
          </ul>
        }
      />

      <section aria-labelledby="capabilities" className="py-20 sm:py-28">
        <div className={container}>
          <SectionHeading
            id="capabilities"
            eyebrow="What you get"
            title={`${area.name}, built in`}
          />
          <div className="mt-12">
            <IconGrid items={area.capabilities} />
          </div>
        </div>
      </section>

      <section aria-labelledby="showcase" className="bg-slate-50 py-20 sm:py-28">
        <div className={`${container} grid items-center gap-14 lg:grid-cols-2`}>
          <div className="lg:order-2">
            <SectionHeading id="showcase" title={area.showcase.title} intro={area.showcase.body} />
            <div className="mt-8">
              <CheckList items={area.showcase.points} />
            </div>
          </div>
          <div className="min-w-0 lg:order-1">
            <FeatureMock kind={area.showcase.mock} />
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="bg-slate-950 py-20 sm:py-28">
        <div className={container}>
          <SectionHeading
            id="how"
            dark
            eyebrow="How it works"
            title="Up and running in three steps"
          />
          <div className="mt-12">
            <Steps dark steps={area.steps} />
          </div>
          {guides.length > 0 ? (
            <p className="mt-10 text-slate-300">
              Step-by-step:{' '}
              {guides.map((g, i) => (
                <span key={g.slug}>
                  {i > 0 ? ' · ' : null}
                  <a
                    href={`/guides/${g.slug}`}
                    className="rounded font-semibold text-indigo-300 hover:text-indigo-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {g.title}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="related" className="py-20 sm:py-28">
        <div className={container}>
          <SectionHeading id="related" eyebrow="Keep exploring" title="Related features" />
          <div className="mt-10">
            <IconGrid
              items={related.map((a) => ({
                icon: a.icon,
                title: a.name,
                body: a.summary,
                href: `/features/${a.slug}`,
              }))}
            />
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
