/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import {
  findThemeTemplate,
  THEME_INDUSTRIES,
  THEME_PRESETS,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import type { ReactNode } from 'react';
import { EmailCapture } from './email-capture';
import { HeroVisual } from './hero-visual';
import { Icon, type IconName } from './icons';
import {
  Arrow,
  buttonLight,
  buttonPrimary,
  buttonSecondary,
  CheckList,
  container,
  display,
  Eyebrow,
  FloatCard,
  focusRing,
  headline,
  IconTile,
  ink,
  lead,
  paper,
  PhotoPanel,
  section,
  SectionHeading,
  Steps,
  textLink,
  textLinkDark,
} from './page-parts';
import { IndustryImage, industryPhoto, Photo } from './photos';
import { RotatingWord } from './rotating-word';
import { TemplateThumb } from './template-thumb';
import { apiDocsUrl, signupUrl } from './urls';

/** What a store in each industry sells, for the rotating hero headline. */
const INDUSTRY_WORDS: Record<string, string> = {
  fashion: 'clothing',
  electronics: 'gadgets',
  beauty: 'skincare',
  home: 'furniture',
  food: 'groceries',
  jewelry: 'jewelry',
  sports: 'outdoor gear',
  kids: 'toys',
  books: 'books',
  pets: 'pet supplies',
  wellness: 'vitamins',
  art: 'artwork',
};

const templates = (ids: string[]) =>
  ids.map(findThemeTemplate).filter((t): t is ThemeTemplate => !!t);

// ── Hero ────────────────────────────────────────────────────────────────────────

const HIGHLIGHTS: { icon: IconName; label: string }[] = [
  { icon: 'layout', label: `${THEME_TEMPLATES.length} store templates` },
  { icon: 'card', label: 'Stripe & Razorpay payments' },
  { icon: 'globe', label: 'Multi-currency checkout' },
  { icon: 'code', label: 'REST API & webhooks' },
  { icon: 'shield', label: 'Two-factor sign-in' },
];

export function HomeHero() {
  const words = THEME_INDUSTRIES.map((i) => INDUSTRY_WORDS[i.id] ?? i.label.toLowerCase());
  return (
    <section className={`relative isolate overflow-hidden ${paper}`}>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_30rem_at_95%_0%,rgb(99_102_241/0.14),transparent),radial-gradient(34rem_24rem_at_0%_100%,rgb(251_191_36/0.12),transparent)]"
      />
      <div
        className={`${container} grid items-center gap-14 pt-12 pb-16 sm:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:pt-20 lg:pb-24`}
      >
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-900/10">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {THEME_TEMPLATES.length} templates for {THEME_INDUSTRIES.length} industries
          </p>
          <h1 className={`mt-6 text-slate-950 ${display}`}>
            Start selling your <RotatingWord words={words} label="products" />{' '}
            <span className="block sm:inline">online</span>
          </h1>
          <p className={`mt-6 max-w-xl text-slate-600 ${lead}`}>
            One platform for your storefront, checkout and back office. Pick a template made for
            your industry and open your store today.
          </p>
          <div className="mt-9">
            <EmailCapture signupUrl={signupUrl} tone="light" />
            <p className="mt-3 text-sm text-slate-500">
              Every new store starts with a 14-day trial.{' '}
              <a href="/pricing" className={textLink}>
                See plans
              </a>
            </p>
          </div>
        </div>
        <HeroVisual />
      </div>
      <div className="border-t border-slate-900/[0.07]">
        <ul
          aria-label="Included with every store"
          className={`${container} flex flex-wrap justify-center gap-x-8 gap-y-3 py-6 text-sm font-medium text-slate-600 lg:justify-between`}
        >
          {HIGHLIGHTS.map((h) => (
            <li key={h.label} className="flex items-center gap-2">
              <span className="text-indigo-600">
                <Icon name={h.icon} className="size-4.5" />
              </span>
              {h.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Template marquee ────────────────────────────────────────────────────────────

/** An auto-scrolling wall of templates (paused on hover; static with reduced motion). */
export function TemplateMarquee() {
  // One template per industry, cycling through styles so the wall shows the catalog's range.
  const wall = THEME_INDUSTRIES.map(
    (industry, i) => THEME_TEMPLATES.filter((t) => t.industry === industry.id)[(i * 2) % 9],
  ).filter((t): t is ThemeTemplate => !!t);
  const item = (t: ThemeTemplate, copy: number) => (
    <li
      key={`${t.id}-${copy}`}
      className="w-64 shrink-0 sm:w-72"
      aria-hidden={copy > 0 || undefined}
    >
      <a
        href={`/templates/${t.id}`}
        tabIndex={copy > 0 ? -1 : undefined}
        className={`group block rounded-2xl ${focusRing}`}
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_30px_-18px_rgb(15_23_42/0.45)] ring-1 ring-slate-900/10 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_24px_48px_-20px_rgb(15_23_42/0.45)]">
          <TemplateThumb template={t} tiles={3} scale={8} className="h-56 sm:h-64" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-950">{t.name}</p>
        <p className="text-xs text-slate-500">
          {t.industryLabel} · {t.styleLabel}
        </p>
      </a>
    </li>
  );
  return (
    <section aria-labelledby="wall-title" className="bg-white py-20 sm:py-24">
      <div className={`${container} flex flex-wrap items-end justify-between gap-6`}>
        <div className="max-w-2xl">
          <Eyebrow>Templates</Eyebrow>
          <h2 id="wall-title" className={`mt-4 text-slate-950 ${headline}`}>
            {THEME_TEMPLATES.length} templates, built for {THEME_INDUSTRIES.length} industries
          </h2>
        </div>
        <a href="/templates" className={buttonSecondary}>
          Browse all templates
        </a>
      </div>
      <div className="mt-12 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] motion-reduce:overflow-x-auto">
        <ul className="flex w-max gap-6 px-6 pb-4 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-safe:animate-[cp-marquee_80s_linear_infinite]">
          {wall.map((t) => item(t, 0))}
          {wall.map((t) => item(t, 1))}
        </ul>
      </div>
    </section>
  );
}

// ── Feature bento ───────────────────────────────────────────────────────────────

const MODULES = [
  'Products & variants',
  'Collections',
  'Inventory',
  'Locations',
  'Orders',
  'Draft orders',
  'Returns',
  'Refunds',
  'Packing slips',
  'Customers',
  'Staff',
  'CSV import',
];

function BentoLink({
  href,
  children,
  dark,
}: {
  href: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <a
      href={href}
      className={`group mt-5 inline-flex items-center gap-1 text-sm ${dark ? textLinkDark : textLink}`}
    >
      {children} <Arrow />
    </a>
  );
}

export function FeatureCards() {
  const store = findThemeTemplate('beauty-split');
  return (
    <section id="features" className={`scroll-mt-16 ${paper} ${section}`}>
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="One platform"
            title="Everything you need to sell online"
            intro="Storefront, checkout, payments and back office are one product — built to work together from your first order."
          />
          <a href="/features" className={buttonSecondary}>
            See all features
          </a>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-6">
          {/* Online store */}
          <article
            id="online-store"
            className="relative isolate flex scroll-mt-24 flex-col overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-slate-900/[0.08] lg:col-span-4"
          >
            <div className="max-w-md p-7 sm:p-9">
              <IconTile name="layout" />
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                Online store
              </h3>
              <p className="mt-2 leading-7 text-slate-600">
                A template for your industry, your own pages, blog, menus and policies, a password
                page for pre-launch, and your own domain with automatic HTTPS.
              </p>
              <BentoLink href="/features/online-store">Explore the online store</BentoLink>
            </div>
            {store ? (
              <div
                aria-hidden="true"
                className="mt-auto ml-7 overflow-hidden rounded-tl-2xl shadow-[0_-10px_40px_-20px_rgb(15_23_42/0.5)] ring-1 ring-slate-900/10 sm:ml-16 lg:absolute lg:top-10 lg:right-0 lg:bottom-0 lg:ml-0 lg:w-[48%]"
              >
                <TemplateThumb template={store} tiles={3} scale={9} className="h-72 lg:h-full" />
              </div>
            ) : null}
          </article>

          {/* Checkout */}
          <article
            id="checkout"
            className={`flex scroll-mt-24 flex-col rounded-[1.75rem] ${ink} p-7 text-white sm:p-9 lg:col-span-2`}
          >
            <IconTile name="card" dark />
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">Checkout</h3>
            <p className="mt-2 leading-7 text-slate-300">
              Prices, stock, discounts, gift cards, shipping and taxes are worked out on the server,
              then shoppers pay on a secure hosted payment page.
            </p>
            <div
              aria-hidden="true"
              className="mt-7 space-y-2 rounded-2xl bg-white/[0.06] p-4 text-sm ring-1 ring-white/10"
            >
              {[
                ['Subtotal', '$80.00'],
                ['WELCOME10', '−$8.00'],
                ['Shipping', '$5.00'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-slate-300">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
                <span>Total</span>
                <span>$77.00</span>
              </div>
            </div>
            <div className="mt-auto">
              <BentoLink href="/features/checkout" dark>
                Explore checkout
              </BentoLink>
            </div>
          </article>

          {/* Back office */}
          <article
            id="back-office"
            className="flex scroll-mt-24 flex-col overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-slate-900/[0.08] lg:col-span-2"
          >
            <div className="aspect-[16/9] overflow-hidden">
              <Photo name="packing-orders" position="center 30%" />
            </div>
            <div className="flex flex-1 flex-col p-7 sm:p-8">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">Back office</h3>
              <p className="mt-2 leading-7 text-slate-600">
                Run the day-to-day from one admin, on desktop or phone.
              </p>
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {MODULES.map((m) => (
                  <li
                    key={m}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {m}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <BentoLink href="/features/orders">Explore orders</BentoLink>
              </div>
            </div>
          </article>

          {/* Marketing */}
          <article
            id="marketing"
            className="relative isolate flex scroll-mt-24 flex-col overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-7 text-white sm:p-8 lg:col-span-2"
          >
            <div
              aria-hidden="true"
              className="absolute -top-20 -right-20 -z-10 size-64 rounded-full bg-white/10 blur-2xl"
            />
            <p className="text-xs font-semibold tracking-[0.14em] text-indigo-100 uppercase">
              Marketing & analytics
            </p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight">Bring shoppers back</h3>
            <p className="mt-2 leading-7 text-indigo-50">
              Run discount codes with schedules and limits, email shoppers who leave checkout
              unfinished, group customers into segments and watch sales on your dashboard.
            </p>
            <div aria-hidden="true" className="mt-6 grid grid-cols-2 gap-2.5 text-sm">
              {[
                ['Discount code', 'SPRING15 · 15% off'],
                ['Abandoned checkout', 'Reminder sent'],
                ['Segment', 'Spent over $200'],
                ['Analytics', 'Sales by day'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-[11px] text-indigo-100">{k}</p>
                  <p className="mt-0.5 text-[13px] font-semibold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-2">
              <a
                href="/features/marketing"
                className={`${buttonLight} mt-6 !px-4 !py-2.5 text-indigo-700`}
              >
                Explore marketing tools
              </a>
            </div>
          </article>

          {/* Payments */}
          <article
            id="get-paid"
            className="relative isolate flex min-h-[26rem] scroll-mt-24 flex-col justify-end overflow-hidden rounded-[1.75rem] p-7 text-white sm:p-8 lg:col-span-2"
          >
            <div className="absolute inset-0 -z-20">
              <Photo name="card-payment" />
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-slate-950/0"
            />
            <h3 className="text-xl font-semibold tracking-tight">Get paid your way</h3>
            <p className="mt-2 leading-7 text-slate-200">
              Connect Stripe or Razorpay and payouts go straight to your own account. Test every
              flow first in the payment sandbox.
            </p>
            <div>
              <BentoLink href="/features/payments" dark>
                Explore payments
              </BentoLink>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

// ── Sell globally ───────────────────────────────────────────────────────────────

const CURRENCIES = [
  ['USD', '$', 'US dollar'],
  ['EUR', '€', 'Euro'],
  ['GBP', '£', 'British pound'],
  ['INR', '₹', 'Indian rupee'],
  ['JPY', '¥', 'Japanese yen'],
  ['CAD', '$', 'Canadian dollar'],
  ['AUD', '$', 'Australian dollar'],
] as const;

export function SellGlobally() {
  return (
    <section id="sell-globally" className={`scroll-mt-16 bg-white ${section}`}>
      <div className={`${container} grid items-center gap-16 lg:grid-cols-2 lg:gap-20`}>
        <PhotoPanel
          photo="phone-shopping"
          ratio="aspect-[5/4]"
          overlayPosition="bottom-right"
          overlay={
            <FloatCard>
              <p className="text-xs font-medium text-slate-500">Currency</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-xs font-semibold">
                {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD'].map((c, i) => (
                  <span
                    key={c}
                    className={`rounded-lg py-1.5 ${i === 1 ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-600">Linen shirt</span>
                <span className="font-semibold">€50.99</span>
              </div>
            </FloatCard>
          }
        />
        <div>
          <SectionHeading
            eyebrow="Sell globally"
            title="Let shoppers pay in their own currency"
            intro="Turn on the currencies you want to sell in, set your exchange rates and choose how prices round. Shoppers switch currency on your storefront, then check out and pay in it — while your reports stay in your store currency."
          />
          <div className="mt-8">
            <CheckList
              items={[
                'Your own rates, so prices never change by surprise',
                'Rounding to whole amounts or .99 endings',
                'Reports stay in your store currency',
              ]}
            />
          </div>
          <ul aria-label="Example currencies" className="mt-8 flex flex-wrap gap-2">
            {CURRENCIES.map(([code, symbol, name]) => (
              <li
                key={code}
                title={name}
                className="flex items-center gap-1.5 rounded-full bg-[#f6f4ef] px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-900/[0.06]"
              >
                <span aria-hidden="true" className="font-semibold text-slate-950">
                  {symbol}
                </span>
                {code}
              </li>
            ))}
          </ul>
          <a
            href="/features/international"
            className={`group mt-8 inline-flex items-center gap-1 ${textLink}`}
          >
            How multi-currency works <Arrow />
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Checkout carousel ───────────────────────────────────────────────────────────

function MockRow({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between text-sm ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
    >
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

const CHECKOUT_CARDS: { title: string; caption: string; body: ReactNode }[] = [
  {
    title: 'Contact & delivery',
    caption: 'Guest checkout or customer accounts',
    body: (
      <div className="space-y-2.5">
        {['Email', 'Full name', 'Address', 'Country'].map((f) => (
          <div
            key={f}
            className="rounded-lg px-3 py-2 text-xs text-slate-400 ring-1 ring-slate-200"
          >
            {f}
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Shipping',
    caption: 'Zones with price, weight and subtotal rules',
    body: (
      <div className="space-y-2.5">
        {[
          ['Standard', '$5.00', true],
          ['Express', '$12.00', false],
          ['Free over $75', '$0.00', false],
        ].map(([n, p, on]) => (
          <div
            key={n as string}
            className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ring-1 ${
              on ? 'bg-indigo-50 ring-indigo-300' : 'ring-slate-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`size-3.5 rounded-full ring-1 ${on ? 'bg-indigo-600 ring-indigo-600' : 'ring-slate-300'}`}
              />
              {n}
            </span>
            <span className="text-slate-600">{p}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Discounts & gift cards',
    caption: 'Codes and gift cards applied at checkout',
    body: (
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
            WELCOME10
          </div>
          <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            Apply
          </div>
        </div>
        <MockRow k="Subtotal" v="$80.00" />
        <MockRow k="Discount" v="−$8.00" />
        <MockRow k="Gift card" v="−$20.00" />
        <MockRow k="Total" v="$52.00" strong />
      </div>
    ),
  },
  {
    title: 'Payment',
    caption: 'Hosted card payment with Stripe or Razorpay',
    body: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200">
          <Icon name="lock" className="size-4 text-emerald-600" />
          Secure payment page
        </div>
        <div className="h-8 rounded-lg ring-1 ring-slate-200" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-8 rounded-lg ring-1 ring-slate-200" />
          <div className="h-8 rounded-lg ring-1 ring-slate-200" />
        </div>
        <div className="rounded-lg bg-indigo-600 py-2 text-center text-sm font-semibold text-white">
          Pay €48.00
        </div>
      </div>
    ),
  },
  {
    title: 'Order status',
    caption: 'A status page and email for every order',
    body: (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-emerald-700">
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100">
            ✓
          </span>
          Thank you, your order is confirmed
        </p>
        <ol className="space-y-2 border-l-2 border-indigo-200 pl-4 text-slate-600">
          <li>Paid</li>
          <li>Fulfilled · tracking number added</li>
          <li className="text-slate-400">Delivered</li>
        </ol>
      </div>
    ),
  },
  {
    title: 'Returns',
    caption: 'Customers request returns from their account',
    body: (
      <div className="space-y-3 text-sm">
        <div className="rounded-lg p-3 ring-1 ring-slate-200">
          <p className="font-medium text-slate-900">Return requested</p>
          <p className="text-xs text-slate-500">1 item · within 30 days</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            Approve
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Decline
          </span>
        </div>
      </div>
    ),
  },
];

export function CheckoutCarousel() {
  return (
    <section
      id="checkout-flow"
      className={`relative isolate scroll-mt-16 overflow-hidden ${ink} ${section} text-white`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(46rem_26rem_at_100%_0%,rgb(99_102_241/0.28),transparent)]"
      />
      <div className={`${container} grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]`}>
        <SectionHeading
          dark
          eyebrow="Checkout"
          title="A checkout that does the maths for you"
          intro="Shoppers move from cart to confirmation in a few steps, and every price is worked out on the server — never trusted from the browser."
        />
        <div className="flex lg:justify-end">
          <a href="/features/checkout" className={`group ${buttonLight}`}>
            Explore checkout <Arrow />
          </a>
        </div>
      </div>
      <ul
        aria-label="Checkout steps"
        className="mx-auto mt-14 flex max-w-7xl snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-6 sm:scroll-px-6 sm:px-6 lg:px-8 [scrollbar-color:rgb(255_255_255/0.2)_transparent]"
      >
        {CHECKOUT_CARDS.map((card, i) => (
          <li key={card.title} className="w-72 shrink-0 snap-start sm:w-80">
            <div
              className="rounded-2xl bg-white p-5 text-slate-900 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)]"
              aria-hidden="true"
            >
              <p className="text-[11px] font-semibold tracking-[0.14em] text-indigo-600 uppercase">
                Step {i + 1}
              </p>
              <p className="mt-1 mb-4 font-semibold">{card.title}</p>
              {card.body}
            </div>
            <p className="mt-5 font-semibold">{card.title}</p>
            <p className="mt-1 text-sm text-slate-400">{card.caption}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── For every industry ──────────────────────────────────────────────────────────

export function IndustriesRow() {
  return (
    <section id="industries" className={`scroll-mt-16 bg-white ${section}`}>
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="For every industry"
            title="Start from a design that fits"
            intro="Nine templates for each of twelve industries, with photos, colors and wording to match what you sell."
          />
          <a href="/templates" className={buttonSecondary}>
            See all industries
          </a>
        </div>
        <ul className="mt-14 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {THEME_INDUSTRIES.map((industry) => (
            <li key={industry.id}>
              <a
                href={`/templates?industry=${industry.id}`}
                className={`group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl p-4 text-white sm:aspect-[4/3] sm:p-5 ${focusRing}`}
              >
                <div className="absolute inset-0 -z-20 transition duration-700 group-hover:scale-105">
                  <IndustryImage src={industryPhoto(industry.id)} />
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent"
                />
                <span className="text-base font-semibold sm:text-lg">{industry.label}</span>
                <span className="mt-0.5 flex items-center justify-between text-sm text-slate-200">
                  {THEME_TEMPLATES.filter((t) => t.industry === industry.id).length} templates
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur transition group-hover:bg-white group-hover:text-slate-950"
                  >
                    →
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Run your business ───────────────────────────────────────────────────────────

export function RunYourBusiness() {
  return (
    <section id="operations" className={`scroll-mt-16 ${paper} ${section}`}>
      <div className={`${container} grid items-center gap-16 lg:grid-cols-2 lg:gap-20`}>
        <div className="lg:order-2">
          <PhotoPanel
            photo="shipping-boxes"
            ratio="aspect-[5/4]"
            overlayPosition="bottom-left"
            overlay={
              <FloatCard>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Order #1042</p>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Unfulfilled
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-lg px-2.5 py-2 text-slate-500 ring-1 ring-slate-200">
                    UPS
                  </span>
                  <span className="rounded-lg px-2.5 py-2 text-slate-500 ring-1 ring-slate-200">
                    1Z 999 AA1
                  </span>
                </div>
                <div className="mt-2 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white">
                  Mark as fulfilled
                </div>
              </FloatCard>
            }
          />
        </div>
        <div className="lg:order-1">
          <SectionHeading
            eyebrow="Run your business"
            title="From first order to packed parcel"
            intro="Track stock across locations, fulfil with tracking numbers, print packing slips and handle returns and refunds — all from the same admin."
          />
          <div className="mt-8">
            <CheckList
              items={[
                'Inventory per variant and per location, with transfers',
                'Draft orders and invoices for phone or wholesale orders',
                'Returns requested by customers, approved by you',
                'Refunds back to the original payment',
              ]}
            />
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="/features/orders" className={buttonPrimary}>
              Orders & fulfilment
            </a>
            <a href="/features/inventory" className={buttonSecondary}>
              Products & inventory
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Developers ──────────────────────────────────────────────────────────────────

export function Developers() {
  const tiles: { icon: IconName; title: string; body: string }[] = [
    {
      icon: 'code',
      title: 'Admin API tokens',
      body: 'Store-scoped access tokens with only the permissions you grant, revocable any time.',
    },
    {
      icon: 'link',
      title: 'Signed webhooks',
      body: 'Order and product events delivered with a signature to verify and automatic retries.',
    },
    {
      icon: 'file',
      title: 'OpenAPI docs',
      body: 'The REST API is described in an OpenAPI document you can browse in your browser.',
    },
    {
      icon: 'switch',
      title: 'CSV import & export',
      body: 'Move your catalog in or out with Shopify-style columns, one row per variant.',
    },
  ];
  return (
    <section
      id="developers"
      className={`relative isolate scroll-mt-16 overflow-hidden ${ink} ${section} text-white`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(40rem_24rem_at_0%_0%,rgb(99_102_241/0.22),transparent)]"
      />
      <div className={`${container} grid items-center gap-14 lg:grid-cols-[1fr_1.1fr]`}>
        <div>
          <SectionHeading
            dark
            eyebrow="Customize & extend"
            title="Connect the tools you already use"
            intro="A documented REST API and webhooks let you sync stock, push orders to your warehouse or build your own integrations."
          />
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href={apiDocsUrl} target="_blank" rel="noreferrer" className={buttonLight}>
              Read the API docs<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a href="/features/developers" className={`group ${textLinkDark} px-2`}>
              Developer features <Arrow />
            </a>
          </div>
          <ul className="mt-12 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {tiles.map((t) => (
              <li key={t.title} className="flex gap-4">
                <IconTile name={t.icon} dark />
                <div>
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{t.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div
          aria-hidden="true"
          className="min-w-0 overflow-hidden rounded-2xl bg-[#11131f] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] ring-1 ring-white/10"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-slate-400">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
            </span>
            <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300">
              POST
            </span>
            <span className="truncate">https://example.com/hooks</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-slate-300 sm:p-6">
            <code>
              <span className="text-slate-500">{'// headers'}</span>
              {'\n'}
              <span className="text-violet-300">x-commerce-topic</span>: orders/paid{'\n'}
              <span className="text-violet-300">x-commerce-hmac-sha256</span>: 3q2+7w…{'\n\n'}
              <span className="text-slate-500">{'// body'}</span>
              {'\n'}
              {'{\n  '}
              <span className="text-sky-300">&quot;id&quot;</span>
              {': '}
              <span className="text-amber-200">&quot;0193…&quot;</span>
              {',\n  '}
              <span className="text-sky-300">&quot;number&quot;</span>
              {': '}
              <span className="text-emerald-300">1042</span>
              {',\n  '}
              <span className="text-sky-300">&quot;total&quot;</span>
              {': '}
              <span className="text-emerald-300">8318</span>
              {',\n  '}
              <span className="text-sky-300">&quot;currency&quot;</span>
              {': '}
              <span className="text-amber-200">&quot;USD&quot;</span>
              {'\n}'}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

// ── Payments & security ─────────────────────────────────────────────────────────

export function Security() {
  const facts = [
    { value: String(THEME_TEMPLATES.length), label: 'store templates' },
    { value: String(THEME_PRESETS.length), label: 'homepage layouts' },
    {
      value: 'SAQ-A',
      label: 'card details are entered on Stripe or Razorpay, never on our servers',
    },
    { value: '2FA', label: 'two-factor sign-in for you and your staff' },
  ];
  return (
    <section id="payments" className={`scroll-mt-16 bg-white ${section}`}>
      <div className={`${container} grid items-center gap-16 lg:grid-cols-2 lg:gap-20`}>
        <PhotoPanel
          photo="checkout-counter"
          ratio="aspect-[5/4]"
          overlayPosition="bottom-right"
          overlay={
            <FloatCard>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="shield" className="size-4 text-indigo-600" />
                Two-factor authentication
              </p>
              <div className="mt-3 flex gap-1.5">
                {[4, 8, 1, 5, 9, 2].map((d, i) => (
                  <span
                    key={i}
                    className="flex h-9 flex-1 items-center justify-center rounded-lg bg-slate-50 font-mono font-semibold text-slate-900 ring-1 ring-slate-200"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </FloatCard>
          }
        />
        <div>
          <SectionHeading
            eyebrow="Payments & security"
            title="Get paid, and keep your store safe"
            intro="Connect Stripe or Razorpay and payouts go straight to your own account. Test the whole flow first with the built-in payment sandbox. Give staff only the permissions they need."
          />
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8">
            {facts.map((f) => (
              <div
                key={f.value}
                className="flex flex-col-reverse border-t border-slate-900/10 pt-4"
              >
                <dt className="mt-1 text-sm leading-6 text-slate-600">{f.label}</dt>
                <dd className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="/features/payments" className={`group inline-flex gap-1 ${textLink}`}>
              Payments <Arrow />
            </a>
            <a href="/security" className={`group inline-flex gap-1 ${textLink}`}>
              How we protect stores <Arrow />
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Getting started ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: 'Create your store',
    body: 'Sign up, verify your email and name your store. It gets its own web address straight away.',
  },
  {
    title: 'Pick a template, add products',
    body: 'Choose a design for your industry, then add products by hand or import them from CSV.',
  },
  {
    title: 'Start selling',
    body: 'Connect Stripe or Razorpay, set shipping and taxes, and open your doors.',
  },
];

export function GetStarted() {
  const mosaic = templates(['beauty-minimal', 'pets-bold', 'kids-banner', 'art-editorial']);
  return (
    <section id="get-started" className={`scroll-mt-16 ${paper} pt-20 sm:pt-28 lg:pt-32`}>
      <div className={container}>
        <SectionHeading center eyebrow="Get started" title="Your store could be live today" />
        <div className="mt-14">
          <Steps steps={STEPS} />
        </div>
      </div>
      <div className="px-4 pt-20 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="relative isolate mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-slate-950 text-white lg:grid-cols-[1.1fr_1fr]">
          <div className="absolute inset-0 -z-20">
            <Photo name="coffee-roaster" alt="" />
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(11_12_20/0.95)_0%,rgb(11_12_20/0.85)_50%,rgb(11_12_20/0.55)_100%)]"
          />
          <div className="px-6 py-14 sm:px-12 sm:py-20 lg:px-16">
            <h2 className={headline}>Open your store in an afternoon</h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-200">
              Pick a template, add your products and connect payments. You can switch templates any
              time.
            </p>
            <div className="mt-9">
              <EmailCapture signupUrl={signupUrl} />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Every new store starts with a 14-day trial.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="hidden grid-cols-2 content-center gap-4 p-10 pl-0 lg:grid"
          >
            {mosaic.map((t, i) => (
              <div
                key={t.id}
                className={`overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15 ${i % 2 ? 'translate-y-6' : ''}`}
              >
                <TemplateThumb template={t} tiles={2} scale={7} className="h-44" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
