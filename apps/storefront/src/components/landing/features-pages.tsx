/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import { FEATURE_AREAS, type FeatureArea, findFeatureArea } from './features-data';
import { findGuide } from './guides-data';
import { Icon } from './icons';
import { FeatureMock } from './mocks';
import {
  Arrow,
  buttonPrimary,
  buttonSecondary,
  CheckList,
  container,
  CtaBand,
  FloatCard,
  focusRing,
  IconGrid,
  IconTile,
  ink,
  PageHero,
  paper,
  PhotoPanel,
  section,
  SectionHeading,
  Steps,
  textLinkDark,
} from './page-parts';
import { Photo, type PhotoName } from './photos';
import { signupUrl } from './urls';

/** Feature areas grouped the way the hub and menus present them. */
export const FEATURE_GROUPS: { title: string; intro: string; slugs: string[] }[] = [
  {
    title: 'Build your store',
    intro: 'A storefront in your colors, on your own domain, in your shoppers’ currency.',
    slugs: ['online-store', 'domains', 'international'],
  },
  {
    title: 'Sell and get paid',
    intro: 'A checkout that works out every total on the server, and payouts to your account.',
    slugs: ['checkout', 'payments', 'marketing'],
  },
  {
    title: 'Run your business',
    intro: 'Stock, orders and numbers in one admin, on desktop or phone.',
    slugs: ['inventory', 'orders', 'analytics'],
  },
  {
    title: 'Grow with confidence',
    intro: 'Staff permissions, two-factor sign-in and an API for your own tools.',
    slugs: ['staff-security', 'developers'],
  },
];

/** The photo that represents each feature area. */
export const FEATURE_PHOTOS: Record<string, PhotoName> = {
  'online-store': 'boutique-interior',
  domains: 'laptop-shop-counter',
  international: 'phone-shopping',
  checkout: 'checkout-counter',
  payments: 'card-payment',
  marketing: 'market-stall',
  inventory: 'shipping-boxes',
  orders: 'packing-orders',
  analytics: 'coffee-roaster',
  'staff-security': 'team-planning',
  developers: 'product-photography',
};

const areas = (slugs: string[]) => slugs.map(findFeatureArea).filter((a): a is FeatureArea => !!a);

/** A feature area as a photo card (hub and related features). */
function AreaCard({ area }: { area: FeatureArea }) {
  return (
    <a
      href={`/features/${area.slug}`}
      className={`group flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-slate-900/[0.08] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-24px_rgb(15_23_42/0.4)] ${focusRing}`}
    >
      <span className="relative block aspect-[16/10] overflow-hidden bg-slate-200">
        <span className="block size-full transition duration-700 group-hover:scale-[1.04]">
          <Photo name={FEATURE_PHOTOS[area.slug] ?? 'boutique-interior'} alt="" />
        </span>
        <span className="absolute top-4 left-4">
          <IconTile name={area.icon} />
        </span>
      </span>
      <span className="flex flex-1 flex-col p-6 sm:p-7">
        <span className="text-lg font-semibold tracking-tight text-slate-950">{area.name}</span>
        <span className="mt-2 text-[0.9375rem] leading-7 text-slate-600">{area.summary}</span>
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-indigo-700">
          Explore {area.name.toLowerCase()} <Arrow />
        </span>
      </span>
    </a>
  );
}

/** `/features`: every feature area, grouped, linking to its page. */
export function FeaturesHub() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything you need to sell online, in one place"
        subtitle="A storefront, checkout and back office that work together from day one. Every feature is included on every plan."
        actions={
          <>
            <a href={signupUrl} className={buttonPrimary}>
              Start for free
            </a>
            <a href="/pricing" className={buttonSecondary}>
              See pricing
            </a>
          </>
        }
        aside={
          <div className="grid grid-cols-[1.25fr_1fr] gap-3 sm:gap-4">
            <div className="row-span-2 overflow-hidden rounded-[1.5rem] shadow-[0_30px_60px_-30px_rgb(15_23_42/0.5)] ring-1 ring-slate-900/10">
              <Photo name="boutique-interior" priority position="40% center" />
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-[1.5rem] ring-1 ring-slate-900/10">
              <Photo name="packing-orders" priority />
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-[1.5rem] ring-1 ring-slate-900/10">
              <Photo name="checkout-counter" priority />
            </div>
          </div>
        }
      />
      <nav
        aria-label="Feature areas"
        className="sticky top-16 z-30 border-y border-slate-900/[0.08] bg-white/90 backdrop-blur-xl"
      >
        <ul className={`${container} flex gap-2 overflow-x-auto py-3`}>
          {FEATURE_AREAS.map((a) => (
            <li key={a.slug} className="shrink-0">
              <a
                href={`/features/${a.slug}`}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-900/10 transition hover:bg-slate-950 hover:text-white hover:ring-slate-950 ${focusRing}`}
              >
                <Icon name={a.icon} className="size-4" />
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
          className={`py-20 sm:py-24 ${i % 2 ? paper : 'bg-white'}`}
        >
          <div className={container}>
            <SectionHeading
              id={`group-${i}`}
              eyebrow={`0${i + 1}`}
              title={group.title}
              intro={group.intro}
            />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {areas(group.slugs).map((a) => (
                <li key={a.slug}>
                  <AreaCard area={a} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      <CtaBand photo="coffee-roaster" />
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
            <a href={signupUrl} className={buttonPrimary}>
              Start for free
            </a>
            {guides[0] ? (
              <a href={`/guides/${guides[0].slug}`} className={buttonSecondary}>
                Read the guide
              </a>
            ) : (
              <a href="/features" className={buttonSecondary}>
                All features
              </a>
            )}
          </>
        }
        aside={
          <PhotoPanel
            photo={FEATURE_PHOTOS[area.slug] ?? 'boutique-interior'}
            priority
            ratio="aspect-[5/4]"
            overlayPosition="bottom-left"
            overlay={
              <FloatCard>
                <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
                  Included
                </p>
                <ul className="mt-3 space-y-2.5">
                  {area.capabilities.slice(0, 3).map((c) => (
                    <li key={c.title} className="flex items-center gap-2.5 text-sm font-medium">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Icon name={c.icon} className="size-4" />
                      </span>
                      {c.title}
                    </li>
                  ))}
                </ul>
              </FloatCard>
            }
          />
        }
      />

      <section aria-labelledby="capabilities" className={`bg-white ${section}`}>
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

      <section aria-labelledby="showcase" className={`${paper} ${section}`}>
        <div className={`${container} grid items-center gap-14 lg:grid-cols-2 lg:gap-20`}>
          <div className="lg:order-2">
            <SectionHeading id="showcase" title={area.showcase.title} intro={area.showcase.body} />
            <div className="mt-8">
              <CheckList items={area.showcase.points} />
            </div>
          </div>
          <div className="relative min-w-0 lg:order-1">
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-0 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgb(99_102_241/0.16),transparent)]"
            />
            <div className="relative">
              <FeatureMock kind={area.showcase.mock} />
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="how"
        className={`relative isolate overflow-hidden ${ink} ${section}`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(40rem_22rem_at_100%_0%,rgb(99_102_241/0.25),transparent)]"
        />
        <div className={container}>
          <SectionHeading
            id="how"
            dark
            eyebrow="How it works"
            title="Up and running in three steps"
          />
          <div className="mt-14">
            <Steps dark steps={area.steps} />
          </div>
          {guides.length > 0 ? (
            <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-8 text-sm text-slate-400">
              <span className="font-semibold text-slate-200">Step-by-step guides</span>
              {guides.map((g) => (
                <a
                  key={g.slug}
                  href={`/guides/${g.slug}`}
                  className={`group inline-flex items-center gap-1 ${textLinkDark}`}
                >
                  {g.title} <Arrow />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="related" className={`bg-white ${section}`}>
        <div className={container}>
          <SectionHeading id="related" eyebrow="Keep exploring" title="Related features" />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((a) => (
              <li key={a.slug}>
                <AreaCard area={a} />
              </li>
            ))}
          </ul>
        </div>
      </section>
      <CtaBand photo={area.slug === 'checkout' ? 'market-stall' : 'checkout-counter'} />
    </>
  );
}
