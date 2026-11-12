/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
/* eslint-disable @next/next/no-img-element -- static same-origin photos with explicit sizes. */
import {
  findThemeTemplate,
  SUPPORTED_CURRENCIES,
  THEME_INDUSTRIES,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import type { ReactNode } from 'react';
import { FeatureMock } from './mocks';
import { displayFace } from './page-parts';
import { Photo, productPhoto } from './photos';
import { HeroWord, StoreTabs } from './store-tabs';
import { TemplateThumb } from '@repo/template-preview';
import { apiDocsUrl, signupUrl } from './urls';

/**
 * The platform home page: a full-bleed photo hero, then rounded dark "stages" that slide over one
 * another. Every number comes from the catalog or contracts, and every feature named here exists.
 */

const wrap = 'mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-[5.5rem]';
const focusWhite =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg';
const pill =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[0.9375rem] font-semibold whitespace-nowrap transition';
const pillLight = `${pill} bg-mk-fg text-mk-bg hover:opacity-85 ${focusWhite}`;
const pillGhost = `${pill} text-mk-fg ring-2 ring-mk-fg/80 hover:bg-mk-surface-2 ${focusWhite}`;
const h2 = `${displayFace} text-[2.5rem] leading-[1.06] font-normal tracking-[-0.03em] text-balance sm:text-[3.25rem] lg:text-[4rem]`;
const h3 = `${displayFace} text-[2rem] leading-[1.1] font-normal tracking-[-0.025em] text-balance sm:text-[2.5rem] lg:text-5xl`;
const inlineLink = `rounded underline underline-offset-2 hover:text-mk-fg ${focusWhite}`;

/** A section that overlaps the one before it with big rounded corners. */
function Stage({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`relative -mt-10 overflow-hidden rounded-t-[2rem] pb-24 sm:rounded-t-[3rem] sm:pb-32 ${className}`}
    >
      {children}
    </section>
  );
}

/** Dark card holding a product mock that bleeds off its lower edge. */
function MockPanel({
  kind,
  className = '',
}: {
  kind: Parameters<typeof FeatureMock>[0]['kind'];
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative h-80 overflow-hidden rounded-2xl bg-mk-surface px-5 pt-6 ring-1 ring-mk-line sm:px-7 sm:pt-8 ${className}`}
    >
      <div className="pointer-events-none origin-top select-none">
        <FeatureMock kind={kind} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-mk-bg/60 to-transparent" />
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────────

const HERO_WORDS = ['fashion label', 'skincare brand', 'coffee shop', 'bookshop', 'pet store'];

function Hero() {
  return (
    <section className="mk-dark relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24 pb-28">
      <div className="absolute inset-0 -z-20 motion-safe:animate-[cp-zoom_24s_ease-out_forwards]">
        <Photo name="laptop-shop-counter" alt="" priority position="60% center" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(3_8_11/0.82)_0%,rgb(3_8_11/0.5)_50%,rgb(3_8_11/0.15)_100%),linear-gradient(0deg,rgb(3_8_11/0.65)_0%,transparent_40%)]"
      />
      <div className={`${wrap} text-mk-fg`}>
        <h1
          aria-label="Open your own online store"
          className={`${displayFace} text-[3.25rem] leading-[1.04] font-normal tracking-[-0.035em] sm:text-7xl lg:text-[6.5rem]`}
        >
          <span aria-hidden="true">
            <span className="block">Open your own</span>
            <span className="block min-h-[2.1em] sm:min-h-[1.05em]">
              <HeroWord words={HERO_WORDS} />
            </span>
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-[1.45] sm:text-[1.375rem]">
          {THEME_TEMPLATES.length} templates, payments through Razorpay, PayU, PhonePe, Cashfree,
          Stripe or cash on delivery, and one admin for your orders, stock and customers.
        </p>
        <div className="mt-9 flex flex-wrap gap-4">
          <a href={signupUrl} className={pillLight}>
            Start for free
          </a>
          <a href="/templates" className={pillGhost}>
            Browse templates
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Template tabs ───────────────────────────────────────────────────────────────

function TemplateTile({ template }: { template: ThemeTemplate }) {
  return (
    <a
      href={`/templates/${template.id}`}
      className={`group relative block overflow-hidden rounded-2xl bg-mk-fg ring-1 ring-mk-line ${focusWhite}`}
    >
      <TemplateThumb
        template={template}
        tiles={3}
        scale={9}
        className="h-[22rem] transition duration-700 group-hover:scale-[1.03] lg:h-[27rem]"
      />
      <span className="absolute bottom-4 left-4 rounded-full bg-slate-950/85 px-3.5 py-1.5 text-sm font-medium text-mk-fg backdrop-blur">
        {template.name} · {template.styleLabel}
      </span>
    </a>
  );
}

const TAB_ROWS: { id: string; label: string; styles: [string, string, string] }[] = [
  { id: 'fashion', label: 'Fashion.', styles: ['fullbleed', 'poster', 'luxe'] },
  { id: 'beauty', label: 'Beauty.', styles: ['editorial', 'fresh', 'split'] },
  { id: 'food', label: 'Food.', styles: ['market', 'bold', 'classic'] },
  { id: 'home', label: 'Home.', styles: ['bento', 'minimal', 'noir'] },
];

function StoreStage() {
  const tabs = TAB_ROWS.map((row) => ({
    id: row.id,
    label: row.label,
    panel: (
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-[1.25fr_0.85fr_1.25fr]">
        {row.styles.map((style) => {
          const template = findThemeTemplate(`${row.id}-${style}`);
          return template ? (
            <li key={style}>
              <TemplateTile template={template} />
            </li>
          ) : null;
        })}
      </ul>
    ),
  }));
  return (
    <Stage label="Templates" className="bg-mk-bg pt-14 text-mk-fg sm:pt-20">
      <div className={wrap}>
        <StoreTabs tabs={tabs} />
        <p className="mt-10 text-lg text-mk-muted">
          Fourteen design styles across {THEME_INDUSTRIES.length} industries.{' '}
          <a href="/templates" className={inlineLink}>
            See all {THEME_TEMPLATES.length} templates
          </a>
          .
        </p>

        {/* Moving house */}
        <div className="mk-dark relative mt-20 grid grid-cols-1 overflow-hidden text-mk-fg rounded-3xl bg-[linear-gradient(120deg,#0a2f2a,#07191c_60%)] ring-1 ring-mk-line sm:mt-28 lg:grid-cols-2">
          <div className="px-7 py-12 sm:px-12 sm:py-16">
            <h2 data-reveal className={h3}>
              Already selling somewhere else? Bring your catalog with you.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-[1.5] text-mk-muted">
              Import your products from a CSV with one row per variant, then follow the{' '}
              <a href="/switch" className={inlineLink}>
                launch checklist
              </a>
              .
            </p>
          </div>
          <div className="relative min-h-72 lg:min-h-0">
            <Photo
              name="shipping-boxes"
              alt=""
              className="absolute inset-0 opacity-80"
              position="center 40%"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#08201f] to-transparent to-50%"
            />
          </div>
        </div>
      </div>
    </Stage>
  );
}

// ── One admin ───────────────────────────────────────────────────────────────────

function FeatureColumn({
  title,
  href,
  linkText,
  children,
  kind,
}: {
  title: string;
  href: string;
  linkText: string;
  children: ReactNode;
  kind: Parameters<typeof FeatureMock>[0]['kind'];
}) {
  return (
    <div>
      <MockPanel kind={kind} />
      <h3 className={`mt-6 text-xl font-medium ${displayFace}`}>{title}</h3>
      <p className="mt-2 leading-6 text-mk-dim">
        <a href={href} className={inlineLink}>
          {linkText}
        </a>{' '}
        {children}
      </p>
    </div>
  );
}

function RunStage() {
  return (
    <section className="bg-mk-bg pb-24 text-mk-fg sm:pb-32">
      <div className={wrap}>
        <h2 data-reveal className={`max-w-3xl ${h2}`}>
          Everything runs from one admin.
        </h2>
        <div data-reveal="stagger" className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-5">
          <FeatureColumn
            kind="storefront"
            title="A store that is ready to sell"
            href="/features/online-store"
            linkText="Pages, blog and menus"
          >
            come with every template, and you can switch design any time.
          </FeatureColumn>
          <FeatureColumn
            kind="orders"
            title="Orders, stock and returns"
            href="/features/orders"
            linkText="Fulfil orders"
          >
            and print packing slips, then approve returns next to live stock counts.
          </FeatureColumn>
          <FeatureColumn
            kind="payments"
            title="Paid your way"
            href="/features/payments"
            linkText="Connect your gateway or COD"
          >
            and the money goes to your own account, with refunds handled in the admin.
          </FeatureColumn>
        </div>

        <h2 data-reveal className={`mt-24 max-w-3xl sm:mt-32 ${h2}`}>
          Sell across borders.
        </h2>
        <div className="mk-dark mt-12 grid grid-cols-1 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0a2440,#06121c_70%)] ring-1 ring-mk-line lg:grid-cols-[1fr_1.2fr]">
          <div className="px-7 py-12 sm:px-12 sm:py-16">
            <p className="text-lg leading-[1.5] text-mk-muted">
              Shoppers can pay in any of {SUPPORTED_CURRENCIES.length} currencies. Set{' '}
              <a href="/features/international" className={inlineLink}>
                shipping zones and taxes
              </a>{' '}
              by country, and sell from{' '}
              <a href="/features/domains" className={inlineLink}>
                your own domain
              </a>{' '}
              with automatic HTTPS.
            </p>
          </div>
          <div aria-hidden="true" className="px-5 pt-2 sm:px-10 lg:pt-12">
            <div className="pointer-events-none h-80 overflow-hidden select-none">
              <FeatureMock kind="currencies" />
            </div>
          </div>
        </div>

        <h2 data-reveal className={`mt-24 max-w-3xl sm:mt-32 ${h2}`}>
          From your first sale to a growing team.
        </h2>
        <ul data-reveal="stagger" className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-5">
          {(
            [
              [
                'market-stall',
                'Start small',
                'Pick a template, add a few products and share your link the same day.',
              ],
              [
                'packing-orders',
                'Grow with confidence',
                'Discounts, customer segments and abandoned-checkout emails bring shoppers back.',
              ],
              [
                'team-planning',
                'Bring in your team',
                'Give staff their own logins with exactly the permissions they need.',
              ],
            ] as const
          ).map(([photo, title, body]) => (
            <li key={title}>
              <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                <Photo name={photo} alt="" />
              </div>
              <h3 className={`mt-6 text-xl font-medium ${displayFace}`}>{title}</h3>
              <p className="mt-2 leading-6 text-mk-dim">{body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-14 flex justify-center">
          <a href="/pricing" className={pillGhost}>
            Pick a plan that fits
          </a>
        </div>
      </div>
    </section>
  );
}

// ── AI, apps and developers ─────────────────────────────────────────────────────

const APPS = [
  'Free-shipping bar',
  'New arrival badges',
  'WhatsApp chat',
  'Share buttons',
  'Store cookie notice',
];

function BuildStage() {
  return (
    <Stage
      label="Design, apps and developers"
      className="mk-dark bg-[linear-gradient(180deg,#1b2fb8_0%,#10196e_22%,#070b2e_60%,#05090c_100%)] pt-16 text-mk-fg sm:pt-24"
    >
      <div className={wrap}>
        <h2 data-reveal className={`max-w-3xl ${h2}`}>
          Restyle your store by describing it.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="relative flex min-h-[24rem] items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(40rem_24rem_at_70%_30%,rgb(96_120_255/0.45),transparent_70%),#080c33] p-6 ring-1 ring-mk-line sm:p-12">
            <div
              aria-hidden="true"
              className="w-full max-w-lg rounded-2xl bg-mk-fg p-5 text-slate-900 shadow-2xl"
            >
              <p className="text-lg">Make it warmer, with a serif headline and a bolder hero</p>
              <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
                <span>AI design assistant</span>
                <span className="flex size-9 items-center justify-center rounded-full bg-azure-600 text-mk-fg">
                  ↑
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-end rounded-3xl bg-mk-surface p-7 ring-1 ring-mk-line sm:p-10">
            <h3 className={h3.replace('lg:text-5xl', 'lg:text-4xl')}>
              Preview first. Publish when you like it.
            </h3>
            <p className="mt-4 leading-[1.6] text-mk-muted">
              The theme editor autosaves to a private draft, so shoppers keep seeing your live store
              until you publish. The AI assistant is available when the platform has it switched on.
            </p>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 items-center gap-10 sm:mt-32 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 data-reveal className={h3}>
              Add features without touching code.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-[1.5] text-mk-muted">
              Turn on built-in apps from your admin. They run on our platform, so no outside scripts
              are added to your store.
            </p>
          </div>
          <ul className="flex flex-wrap gap-3">
            {APPS.map((app) => (
              <li
                key={app}
                className="rounded-full bg-mk-surface-2 px-5 py-3 ring-1 ring-mk-line backdrop-blur"
              >
                {app}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-24 sm:mt-32">
          <h2 data-reveal className={`max-w-3xl ${h3}`}>
            Developers get a real API.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-[1.5] text-mk-muted">
            Scoped{' '}
            <a href="/features/developers" className={inlineLink}>
              admin API tokens
            </a>
            , signed webhooks and an{' '}
            <a href={apiDocsUrl} target="_blank" rel="noreferrer" className={inlineLink}>
              OpenAPI reference
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{' '}
            let you connect your store to anything.
          </p>
          <div
            aria-hidden="true"
            className="mt-10 overflow-hidden rounded-2xl bg-[#04071f]/90 shadow-2xl ring-1 ring-mk-line"
          >
            <div className="flex items-center gap-2 border-b border-mk-line px-5 py-3.5 text-xs text-mk-dim">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-rose-400" />
                <span className="size-2.5 rounded-full bg-amber-300" />
                <span className="size-2.5 rounded-full bg-leaf-400" />
              </span>
              <span className="ml-3 truncate">POST https://example.com/hooks</span>
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-6 text-mk-muted">
              <code>
                <span className="text-mk-accent">x-commerce-topic</span>: orders/paid{'\n'}
                <span className="text-mk-accent">x-commerce-hmac-sha256</span>: 3q2+7w…{'\n\n'}
                {'{ '}
                <span className="text-mk-accent">&quot;number&quot;</span>
                {': '}
                <span className="text-amber-200">1042</span>
                {', '}
                <span className="text-mk-accent">&quot;total&quot;</span>
                {': '}
                <span className="text-amber-200">8318</span>
                {', '}
                <span className="text-mk-accent">&quot;currency&quot;</span>
                {': '}
                <span className="text-mk-leaf">&quot;USD&quot;</span>
                {' }'}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// ── Checkout and trust ──────────────────────────────────────────────────────────

/** Product photos floating around the checkout. */
const FLOATERS = [
  ['fashion', 1, 'left-[2%] top-[6%] size-16 -rotate-6'],
  ['beauty', 2, 'right-[4%] top-[2%] size-20 rotate-6'],
  ['home', 3, 'left-[46%] top-[-2%] size-14 rotate-3'],
  ['jewelry', 1, 'right-[1%] bottom-[20%] size-16 -rotate-3'],
  ['food', 2, 'left-[38%] bottom-[2%] size-20 rotate-6'],
] as const;

function Globe() {
  const meridians = [18, 42, 66, 90];
  return (
    <svg viewBox="0 0 480 480" aria-hidden="true" className="w-full max-w-xl">
      <defs>
        <radialGradient id="cp-globe" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#1f7a6c" />
          <stop offset="55%" stopColor="#0b3532" />
          <stop offset="100%" stopColor="#03100f" />
        </radialGradient>
        <linearGradient id="cp-arc" x1="0" x2="1">
          <stop offset="0%" stopColor="#6ee0a0" stopOpacity="0" />
          <stop offset="100%" stopColor="#c8ffe0" />
        </linearGradient>
      </defs>
      <circle cx="240" cy="240" r="210" fill="url(#cp-globe)" />
      <g fill="none" stroke="rgb(200 255 224 / 0.14)">
        {meridians.map((rx) => (
          <ellipse key={rx} cx="240" cy="240" rx={rx * 2.3} ry="210" />
        ))}
        {[-140, -70, 0, 70, 140].map((dy) => (
          <ellipse
            key={dy}
            cx="240"
            cy={240 + dy}
            rx={Math.sqrt(210 * 210 - dy * dy)}
            ry={Math.sqrt(210 * 210 - dy * dy) * 0.16}
          />
        ))}
      </g>
      <g fill="none" stroke="url(#cp-arc)" strokeWidth="2" strokeLinecap="round">
        <path d="M130 200Q220 60 330 150" />
        <path d="M150 300Q250 180 360 260" />
        <path d="M210 360Q300 330 345 240" />
      </g>
      <g fill="#c8ffe0">
        {[
          [130, 200],
          [330, 150],
          [150, 300],
          [360, 260],
          [210, 360],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" />
        ))}
      </g>
    </svg>
  );
}

function TrustStage() {
  const facts: [string, string, string][] = [
    ['Currencies', String(SUPPORTED_CURRENCIES.length), 'for shoppers to pay in'],
    ['Free trial', '14', 'days on every new store'],
    ['Card data', '0', 'card numbers ever reach our servers'],
  ];
  return (
    <Stage
      label="Checkout and security"
      className="mk-dark bg-[linear-gradient(180deg,#0c3a30_0%,#072019_40%,#04100e_100%)] pt-16 text-mk-fg sm:pt-24"
    >
      <div className={wrap}>
        <h2 data-reveal className={`mx-auto max-w-3xl text-center ${h2}`}>
          Built so the sale gets finished.
        </h2>
        <div className="mt-14 grid grid-cols-1 items-center gap-12 lg:mt-20 lg:grid-cols-2">
          <div>
            <h3 className={h3}>A checkout that does the sums for you.</h3>
            <dl className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {facts.map(([label, value, note]) => (
                <div key={label} className="flex flex-col-reverse">
                  <dt className="mt-1 text-sm leading-5 text-mk-dim">
                    <span className="block font-semibold tracking-wide text-mk-leaf uppercase">
                      {label}
                    </span>
                    {note}
                  </dt>
                  <dd className={`text-6xl tracking-[-0.03em] ${displayFace}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-10 max-w-lg leading-[1.6] text-mk-muted">
              Prices, discounts and taxes are worked out on the server, never trusted from the
              browser. Shoppers enter card details on Stripe or Razorpay&apos;s hosted page.
            </p>
          </div>
          <div className="relative py-10">
            {FLOATERS.map(([industry, n, position]) => (
              <img
                key={`${industry}-${n}`}
                src={productPhoto(industry, n)}
                width={600}
                height={600}
                alt=""
                loading="lazy"
                decoding="async"
                className={`absolute z-0 hidden rounded-xl object-cover shadow-xl lg:block ${position}`}
              />
            ))}
            <div
              aria-hidden="true"
              className="pointer-events-none relative z-10 mx-auto max-w-md select-none"
            >
              <FeatureMock kind="checkout" />
            </div>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 items-center gap-10 sm:mt-32 lg:grid-cols-2">
          <Globe />
          <div>
            <h2 data-reveal className={h3}>
              Every store is kept apart.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-[1.5] text-mk-muted">
              Store data is separated in the database itself as well as in the application. Staff
              roles and two-factor sign-in protect your admin.{' '}
              <a href="/security" className={inlineLink}>
                How we protect stores
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </Stage>
  );
}

// ── Closing ─────────────────────────────────────────────────────────────────────

function ClosingStage() {
  const steps = ['Pick a template', 'Add your products', 'Connect payments'];
  return (
    <Stage label="Get started" className="bg-mk-subtle pt-16 text-mk-fg sm:pt-24">
      <div className={wrap}>
        <h2 data-reveal className={`text-center ${h2}`}>
          Your store could be live today.
        </h2>
        <div className="mt-14 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-[3/4] overflow-hidden rounded-2xl">
              <Photo name="product-photography" alt="" />
            </div>
            <div className="mt-10 aspect-[3/4] overflow-hidden rounded-2xl">
              <Photo name="boutique-interior" alt="" />
            </div>
          </div>
          <div>
            <ol>
              {steps.map((step, i) => (
                <li
                  key={step}
                  className={`flex items-baseline gap-6 border-b border-mk-line py-6 text-[1.75rem] tracking-[-0.02em] sm:text-4xl ${displayFace}`}
                >
                  <span className="font-mono text-sm text-mk-leaf">0{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <a href={signupUrl} className={`mt-10 ${pillLight}`}>
              Start for free
            </a>
            <p className="mt-4 text-sm text-mk-dim">
              Free for 7 days, then ₹99/month for 3 months.
            </p>
          </div>
        </div>
      </div>
    </Stage>
  );
}

/** The whole home page. */
export function CinematicHome() {
  return (
    <div className="bg-mk-bg">
      <Hero />
      <StoreStage />
      <RunStage />
      <BuildStage />
      <TrustStage />
      <ClosingStage />
    </div>
  );
}
