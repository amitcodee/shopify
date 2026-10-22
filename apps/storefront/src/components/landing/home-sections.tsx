import {
  findThemeTemplate,
  THEME_INDUSTRIES,
  THEME_PRESETS,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import { EmailCapture } from './email-capture';
import { HeroVisual } from './hero-visual';
import { Icon, type IconName } from './icons';
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

const eyebrow = 'text-sm font-semibold tracking-wide text-indigo-600';
const h2 = 'mt-3 text-3xl font-bold tracking-tight text-balance sm:text-5xl';
const container = 'mx-auto max-w-7xl px-4 sm:px-6';

// ── Hero ────────────────────────────────────────────────────────────────────────

export function HomeHero() {
  const words = THEME_INDUSTRIES.map((i) => INDUSTRY_WORDS[i.id] ?? i.label.toLowerCase());
  return (
    <section className="relative isolate overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_30rem_at_80%_10%,rgb(79_70_229/0.45),transparent),radial-gradient(40rem_28rem_at_0%_100%,rgb(139_92_246/0.3),transparent)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div
        className={`${container} grid items-center gap-16 pt-16 pb-28 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:pt-28 lg:pb-36`}
      >
        <div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Start selling your <RotatingWord words={words} label="products" />{' '}
            <span className="block sm:inline">online</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            One platform for your storefront, checkout and back office. Pick a template made for
            your industry and open your store today.
          </p>
          <div className="mt-10">
            <EmailCapture signupUrl={signupUrl} />
            <p className="mt-3 text-sm text-slate-400">
              Every new store starts with a 14-day trial.
            </p>
          </div>
        </div>
        <HeroVisual />
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
    <li key={`${t.id}-${copy}`} className="w-60 shrink-0" aria-hidden={copy > 0 || undefined}>
      <a
        href={`/templates?industry=${t.industry}`}
        tabIndex={copy > 0 ? -1 : undefined}
        className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
      >
        <div className="overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200 transition group-hover:shadow-lg">
          <TemplateThumb template={t} tiles={3} className="h-44" />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{t.name}</p>
        <p className="text-xs text-slate-500">
          {t.industryLabel} · {t.styleLabel}
        </p>
      </a>
    </li>
  );
  return (
    <section aria-labelledby="wall-title" className="border-b border-slate-200 bg-white py-14">
      <div className={`${container} flex flex-wrap items-end justify-between gap-4`}>
        <h2 id="wall-title" className="text-lg font-semibold text-slate-900">
          108 templates, built for 12 industries
        </h2>
        <a
          href="/templates"
          className="rounded text-sm font-semibold text-indigo-600 hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Browse all templates →
        </a>
      </div>
      <div className="mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:overflow-x-auto">
        <ul className="flex w-max gap-6 px-6 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-safe:animate-[cp-marquee_60s_linear_infinite]">
          {wall.map((t) => item(t, 0))}
          {wall.map((t) => item(t, 1))}
        </ul>
      </div>
    </section>
  );
}

// ── Feature cards ───────────────────────────────────────────────────────────────

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

function FeatureCard({
  id,
  icon,
  title,
  body,
  children,
}: {
  id: string;
  icon: IconName;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <article
      id={id}
      className="flex scroll-mt-24 flex-col rounded-3xl bg-white p-7 ring-1 ring-slate-200 sm:p-8"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        <Icon name={icon} />
      </span>
      <h3 className="mt-5 text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 leading-7 text-slate-600">{body}</p>
      {children}
    </article>
  );
}

export function FeatureCards() {
  return (
    <section id="features" className="scroll-mt-16 bg-slate-50 py-24 sm:py-32">
      <div className={container}>
        <div className="max-w-3xl">
          <p className={eyebrow}>One platform</p>
          <h2 className={`${h2} text-slate-900`}>Everything you need to sell online</h2>
        </div>
        <article
          id="marketing"
          className="relative isolate mt-14 grid scroll-mt-24 gap-10 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white sm:p-12 lg:grid-cols-2"
        >
          <div>
            <p className="text-sm font-semibold text-indigo-200">Marketing & analytics</p>
            <h3 className="mt-3 text-3xl font-bold tracking-tight">Bring shoppers back</h3>
            <p className="mt-4 max-w-lg leading-7 text-indigo-100">
              Run discount codes with schedules and limits, email shoppers who leave checkout
              unfinished, group customers into segments and watch sales on your dashboard.
            </p>
          </div>
          <div aria-hidden="true" className="grid grid-cols-2 gap-3 self-center text-sm">
            {[
              ['Discount code', 'SPRING15 · 15% off'],
              ['Abandoned checkout', 'Reminder email sent'],
              ['Segment', 'Spent over $200'],
              ['Analytics', 'Sales by day'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur"
              >
                <p className="text-xs text-indigo-200">{k}</p>
                <p className="mt-1 font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </article>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <FeatureCard
            id="online-store"
            icon="layout"
            title="Online store"
            body="A template for your industry, your own pages, blog, menus and policies, a password page for pre-launch, and your own domain with automatic HTTPS."
          />
          <FeatureCard
            id="checkout"
            icon="card"
            title="Checkout"
            body="Prices, stock, discounts, gift cards, shipping and taxes are worked out on the server, then shoppers pay on a secure hosted payment page."
          />
          <FeatureCard
            id="back-office"
            icon="box"
            title="Back office"
            body="Run the day-to-day from one admin, on desktop or phone."
          >
            <ul className="mt-5 flex flex-wrap gap-2">
              {MODULES.map((m) => (
                <li
                  key={m}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {m}
                </li>
              ))}
            </ul>
          </FeatureCard>
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
  ['SGD', '$', 'Singapore dollar'],
  ['AED', 'د.إ', 'UAE dirham'],
] as const;

export function SellGlobally() {
  return (
    <section id="sell-globally" className="scroll-mt-16 py-24 sm:py-32">
      <div className={`${container} grid items-center gap-14 lg:grid-cols-2`}>
        <div>
          <p className={eyebrow}>Sell globally</p>
          <h2 className={`${h2} text-slate-900`}>Let shoppers pay in their own currency</h2>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Turn on the currencies you want to sell in, set your exchange rates and choose how
            prices round. Shoppers switch currency on your storefront, then check out and pay in it
            — while your reports stay in your store currency.
          </p>
          <ul className="mt-8 space-y-3 text-slate-700">
            {[
              'Your own rates, so prices never change by surprise',
              'Rounding to whole amounts or .99 endings',
              'Reports stay in your store currency',
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <span className="mt-0.5 text-indigo-600">
                  <Icon name="globe" className="size-5" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <ul aria-label="Example currencies" className="grid grid-cols-3 gap-3 sm:gap-4">
          {CURRENCIES.map(([code, symbol, name], i) => (
            <li
              key={code}
              className={`rounded-2xl p-4 ring-1 sm:p-5 ${
                i === 0
                  ? 'bg-slate-950 text-white ring-slate-950'
                  : 'bg-white text-slate-900 ring-slate-200'
              }`}
            >
              <span className="text-2xl font-bold sm:text-3xl" aria-hidden="true">
                {symbol}
              </span>
              <p className="mt-3 text-sm font-semibold">{code}</p>
              <p className={`text-xs ${i === 0 ? 'text-slate-300' : 'text-slate-500'}`}>{name}</p>
            </li>
          ))}
        </ul>
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

const CHECKOUT_CARDS: { title: string; caption: string; body: React.ReactNode }[] = [
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
    <section id="checkout-flow" className="scroll-mt-16 bg-slate-950 py-24 text-white sm:py-32">
      <div className={container}>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-wide text-indigo-300">Checkout</p>
          <h2 className={h2}>A checkout that does the maths for you</h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Shoppers move from cart to confirmation in a few steps, and every price is worked out on
            the server — never trusted from the browser.
          </p>
        </div>
      </div>
      <ul
        aria-label="Checkout steps"
        className="mx-auto mt-14 flex max-w-7xl snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-6 sm:scroll-px-6 sm:px-6 [scrollbar-color:rgb(255_255_255/0.2)_transparent]"
      >
        {CHECKOUT_CARDS.map((card, i) => (
          <li key={card.title} className="w-72 shrink-0 snap-start sm:w-80">
            <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl" aria-hidden="true">
              <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">
                Step {i + 1}
              </p>
              <p className="mt-1 mb-4 font-semibold">{card.title}</p>
              {card.body}
            </div>
            <p className="mt-4 font-semibold">{card.title}</p>
            <p className="text-sm text-slate-400">{card.caption}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── For every industry ──────────────────────────────────────────────────────────

export function IndustriesRow() {
  const picks = templates(['fashion-split', 'electronics-banner', 'home-editorial']);
  return (
    <section id="industries" className="scroll-mt-16 py-24 sm:py-32">
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className={eyebrow}>For every industry</p>
            <h2 className={`${h2} text-slate-900`}>Start from a design that fits</h2>
          </div>
          <a
            href="/templates"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            See all industries
          </a>
        </div>
        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {picks.map((t) => (
            <li key={t.id}>
              <a
                href={`/templates?industry=${t.industry}`}
                className="group block rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200 transition hover:ring-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <div className="overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200">
                  <TemplateThumb template={t} tiles={3} className="h-60" />
                </div>
                <div className="flex items-center justify-between gap-4 px-2 pt-5 pb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{t.industryLabel}</h3>
                    <p className="text-sm text-slate-600">9 templates</p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-full bg-white text-slate-900 ring-1 ring-slate-200 transition group-hover:bg-indigo-600 group-hover:text-white group-hover:ring-indigo-600"
                  >
                    →
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Developers ──────────────────────────────────────────────────────────────────

export function Developers() {
  const tiles: { icon: IconName; title: string; body: string; href?: string }[] = [
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
      href: apiDocsUrl,
    },
    {
      icon: 'switch',
      title: 'CSV import & export',
      body: 'Move your catalog in or out with Shopify-style columns, one row per variant.',
    },
  ];
  return (
    <section id="developers" className="scroll-mt-16 bg-slate-50 py-24 sm:py-32">
      <div className={`${container} grid gap-14 lg:grid-cols-[1fr_1.4fr]`}>
        <div>
          <p className={eyebrow}>Customize & extend</p>
          <h2 className={`${h2} text-slate-900`}>Connect the tools you already use</h2>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            A documented REST API and webhooks let you sync stock, push orders to your warehouse or
            build your own integrations.
          </p>
          <a
            href={apiDocsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-block rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Read the API docs<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {tiles.map((t) => (
            <li key={t.title} className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <span className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                <Icon name={t.icon} />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{t.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{t.body}</p>
            </li>
          ))}
        </ul>
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
    <section id="payments" className="scroll-mt-16 py-24 sm:py-32">
      <div className={`${container} grid items-center gap-16 lg:grid-cols-2`}>
        <div>
          <p className={eyebrow}>Payments & security</p>
          <h2 className={`${h2} text-slate-900`}>Get paid, and keep your store safe</h2>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Connect Stripe or Razorpay and payouts go straight to your own account. Test the whole
            flow first with the built-in payment sandbox. Give staff only the permissions they need.
          </p>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8">
            {facts.map((f) => (
              <div
                key={f.value}
                className="flex flex-col-reverse border-l-2 border-indigo-500 pl-4"
              >
                <dt className="mt-1 text-sm leading-6 text-slate-600">{f.label}</dt>
                <dd className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div aria-hidden="true" className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-100 to-violet-100" />
          <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900">Payments</p>
            <div className="mt-4 space-y-3">
              {[
                ['Stripe', 'Connected · payouts on', true],
                ['Razorpay', 'Available', false],
                ['Sandbox', 'Test mode for checkouts', false],
              ].map(([name, status, on]) => (
                <div
                  key={name as string}
                  className="flex items-center justify-between rounded-xl px-4 py-3 ring-1 ring-slate-200"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{name}</p>
                    <p className="text-xs text-slate-500">{status}</p>
                  </div>
                  <span
                    className={`h-5 w-9 rounded-full p-0.5 ${on ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`block size-4 rounded-full bg-white ${on ? 'translate-x-4' : ''}`}
                    />
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icon name="shield" className="size-4 text-indigo-600" />
                Two-factor authentication
              </p>
              <div className="mt-3 flex gap-2">
                {[4, 8, 1, 5, 9, 2].map((d, i) => (
                  <span
                    key={i}
                    className="flex h-10 flex-1 items-center justify-center rounded-lg bg-white font-mono text-lg font-semibold text-slate-900 ring-1 ring-slate-200"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
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
  const mosaic = templates([
    'beauty-minimal',
    'pets-bold',
    'kids-banner',
    'art-editorial',
    'wellness-split',
    'food-fullbleed',
  ]);
  return (
    <section
      id="get-started"
      className="scroll-mt-16 overflow-hidden bg-slate-950 py-24 text-white sm:py-32"
    >
      <div className={container}>
        <div aria-hidden="true" className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-6">
          {mosaic.map((t, i) => (
            <div
              key={t.id}
              className={`overflow-hidden rounded-xl ring-1 ring-white/10 ${i % 2 ? 'md:translate-y-6' : ''} ${i >= 3 ? 'hidden md:block' : ''}`}
            >
              <TemplateThumb template={t} tiles={2} className="h-36 sm:h-44" />
            </div>
          ))}
        </div>
        <div className="mx-auto mt-20 max-w-3xl text-center">
          <p className="text-sm font-semibold tracking-wide text-indigo-300">Get started</p>
          <h2 className={h2}>Your store could be live today</h2>
        </div>
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
              <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold">
                {i + 1}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 leading-7 text-slate-300">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-14 flex flex-col items-center gap-3">
          <EmailCapture signupUrl={signupUrl} />
          <p className="text-sm text-slate-400">Every new store starts with a 14-day trial.</p>
        </div>
      </div>
    </section>
  );
}
