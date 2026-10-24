/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import {
  SUPPORTED_CURRENCIES,
  THEME_INDUSTRIES,
  THEME_PRESETS,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import {
  Arrow,
  buttonLight,
  buttonPrimary,
  buttonSecondary,
  container,
  displayFace,
  focusRing,
  glass,
  glassDark,
  headline,
  ink,
  lead,
  paper,
  section,
} from './page-parts';
import { fetchPublicPlans } from './public-api';
import { TemplateThumb } from './template-thumb';
import { signupUrl } from './urls';

function Green({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <span className={dark ? 'text-leaf-400' : 'text-leaf-500'}>{children}</span>;
}

// ── Stats ───────────────────────────────────────────────────────────────────────

/** Big honest numbers, straight from the product's own catalog and settings. */
export function StatsBand() {
  const stats: [string, string][] = [
    [String(THEME_TEMPLATES.length), 'store templates, ready to use'],
    [String(THEME_INDUSTRIES.length), 'industries, each with nine designs'],
    [String(THEME_PRESETS.length), 'homepage layouts to start from'],
    [String(SUPPORTED_CURRENCIES.length), 'currencies shoppers can pay in'],
  ];
  return (
    <section aria-label="In numbers" className="bg-white py-16 sm:py-20">
      <div className={container}>
        <dl className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="flex flex-col-reverse border-l-2 border-azure-600 pl-5">
              <dt className="mt-2 leading-6 text-slate-600">{label}</dt>
              <dd
                className={`text-5xl font-medium tracking-[-0.035em] text-navy-900 sm:text-6xl ${displayFace}`}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ── Control centre ──────────────────────────────────────────────────────────────

const ORBIT: { icon: IconName; label: string; at: string }[] = [
  { icon: 'box', label: 'Products', at: 'top-[6%] left-[12%]' },
  { icon: 'truck', label: 'Orders', at: 'top-[4%] right-[14%]' },
  { icon: 'users', label: 'Customers', at: 'top-[44%] -left-[2%]' },
  { icon: 'stack', label: 'Inventory', at: 'top-[44%] -right-[2%]' },
  { icon: 'tag', label: 'Discounts', at: 'bottom-[8%] left-[10%]' },
  { icon: 'chart', label: 'Analytics', at: 'bottom-[6%] right-[12%]' },
];

export function ControlCenter() {
  return (
    <section
      id="control"
      className={`relative isolate scroll-mt-16 overflow-hidden ${ink} ${section} text-white`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_30rem_at_75%_50%,rgb(48_94_255/0.25),transparent_70%)]"
      />
      <div className={`${container} grid items-center gap-14 lg:grid-cols-[1fr_1.15fr]`}>
        <div>
          <h2 className={headline}>
            Control everything
            <br />
            <Green dark>in one place</Green>
          </h2>
          <p className={`mt-6 max-w-lg text-slate-300 ${lead}`}>
            Products, orders, customers, stock, discounts and reports live in one admin — on your
            desktop or your phone.
          </p>
          <ul className="mt-9 space-y-4">
            {[
              [
                'Orders & fulfilment',
                'Tracking numbers, packing slips, returns and refunds',
                '/features/orders',
              ],
              [
                'Products & inventory',
                'Variants, stock per location and CSV import',
                '/features/inventory',
              ],
              [
                'Staff & security',
                'Roles, permissions and two-factor sign-in',
                '/features/staff-security',
              ],
            ].map(([title, body, href]) => (
              <li key={title}>
                <a
                  href={href}
                  className="group flex items-start gap-4 rounded-lg p-3 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf-500/20 text-leaf-300">
                    <Icon name="rocket" className="size-3.5" />
                  </span>
                  <span>
                    <span className="flex items-center gap-1 font-semibold">
                      {title} <Arrow />
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-400">{body}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[34rem]">
          {[100, 78, 56].map((size) => (
            <div
              key={size}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-azure-300/20"
              style={{ width: `${size}%`, height: `${size}%` }}
            />
          ))}
          <div className="absolute top-1/2 left-1/2 w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-4 text-navy-900 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)] sm:p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-6 items-center justify-center rounded-full bg-leaf-500 text-white">
                ✓
              </span>
              Order #1042 confirmed
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span>Linen shirt · M</span>
              <span>$54.00</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-600">
              <span>Shipping</span>
              <span>$5.00</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-semibold">
              <span>Total</span>
              <span>$59.00</span>
            </div>
            <div className="mt-3 rounded-md bg-azure-600 py-1.5 text-center text-xs font-semibold text-white">
              Fulfil order
            </div>
          </div>
          {ORBIT.map((o) => (
            <span
              key={o.label}
              className={`absolute flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white sm:text-sm ${glassDark} ${o.at}`}
            >
              <Icon name={o.icon} className="size-3.5 text-azure-200" />
              {o.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Sell worldwide ──────────────────────────────────────────────────────────────

/** The same product priced in each currency, placed (in %) around the store in the middle. */
const PRICES: { code: string; price: string; x: number; y: number }[] = [
  { code: 'USD', price: '$54.00', x: 14, y: 18 },
  { code: 'EUR', price: '€49.90', x: 50, y: 9 },
  { code: 'GBP', price: '£42.00', x: 84, y: 20 },
  { code: 'INR', price: '₹4,499', x: 86, y: 70 },
  { code: 'JPY', price: '¥7,900', x: 52, y: 86 },
  { code: 'AUD', price: 'A$82.00', x: 13, y: 72 },
];

export function SellWorldwide() {
  return (
    <section id="worldwide" className={`scroll-mt-16 ${paper} ${section}`}>
      <div className={`${container} grid items-center gap-14 lg:grid-cols-[1fr_1.2fr]`}>
        <div>
          <h2 className={`text-navy-900 ${headline}`}>
            Sell around <Green>the world</Green>
          </h2>
          <p className={`mt-6 max-w-lg text-slate-600 ${lead}`}>
            Turn on the currencies you want, set your own exchange rates and rounding, and let
            shoppers check out and pay in their own money.
          </p>
          <ul className="mt-8 space-y-3 text-slate-700">
            {[
              'Your rates, so prices never change by surprise',
              'Rounding to whole amounts or .99 endings',
              'Reports stay in your store currency',
              'Your own domain with automatic HTTPS',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-azure-600 text-[11px] text-white">
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
          <a href="/features/international" className={`group mt-9 ${buttonPrimary}`}>
            How multi-currency works <Arrow />
          </a>
        </div>

        <div
          aria-hidden="true"
          className="relative isolate aspect-[5/4] overflow-hidden rounded-xl bg-gradient-to-br from-azure-50 via-white to-[#d8ebf0] ring-1 ring-slate-900/[0.06]"
        >
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle,rgb(48_94_255/0.28)_1.2px,transparent_1.6px)] bg-[size:14px_14px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,black,transparent)]" />
          {/* Dashed routes from the store to each market. */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 -z-10 size-full text-azure-600/45"
          >
            {PRICES.map((p) => (
              <path
                key={p.code}
                d={`M50 50 Q ${(50 + p.x) / 2 + (p.y < 50 ? -8 : 8)} ${(50 + p.y) / 2 - 10} ${p.x} ${p.y}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="4 5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {PRICES.map((p) => (
            <div
              key={p.code}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <div className={`rounded-lg px-3 py-2 text-center ${glass}`}>
                <p className="text-[10px] font-semibold tracking-wide text-slate-500">{p.code}</p>
                <p className={`text-sm font-semibold text-navy-900 ${displayFace}`}>{p.price}</p>
              </div>
            </div>
          ))}
          <div className="absolute top-1/2 left-1/2 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-3 text-center shadow-[0_24px_50px_-20px_rgb(10_34_54/0.45)] ring-1 ring-slate-900/[0.06]">
            <span className="relative mx-auto flex size-10 items-center justify-center rounded-lg bg-azure-600 text-white">
              <span className="absolute inset-0 animate-ping rounded-lg bg-azure-500/30 motion-reduce:animate-none" />
              <Icon name="globe" className="size-5" />
            </span>
            <p className="mt-2 text-sm font-semibold text-navy-900">Your store</p>
            <p className="text-xs text-slate-500">
              Linen shirt · {SUPPORTED_CURRENCIES.length} currencies
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Template showcase ───────────────────────────────────────────────────────────

/** Two rows of templates drifting in opposite directions on a dark wall. */
export function TemplateShowcase() {
  const byIndustry = (offset: number) =>
    THEME_INDUSTRIES.map(
      (industry, i) =>
        THEME_TEMPLATES.filter((t) => t.industry === industry.id)[(i * 2 + offset) % 9],
    ).filter((t): t is ThemeTemplate => !!t);
  const row = (list: ThemeTemplate[], reverse: boolean) => {
    const card = (t: ThemeTemplate, copy: number) => (
      <li
        key={`${t.id}-${copy}`}
        className="w-60 shrink-0 sm:w-72"
        aria-hidden={copy > 0 || undefined}
      >
        <a
          href={`/templates/${t.id}`}
          tabIndex={copy > 0 ? -1 : undefined}
          className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <div className="overflow-hidden rounded-lg ring-1 ring-white/10 transition duration-300 group-hover:-translate-y-1 group-hover:ring-white/30">
            <TemplateThumb template={t} tiles={3} scale={8} className="h-48 sm:h-56" />
          </div>
          <p className="mt-3 text-sm font-semibold text-white">{t.name}</p>
          <p className="text-xs text-slate-400">
            {t.industryLabel} · {t.styleLabel}
          </p>
        </a>
      </li>
    );
    return (
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:overflow-x-auto">
        <ul
          className={`flex w-max gap-5 px-5 pb-2 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] ${
            reverse
              ? 'motion-safe:animate-[cp-marquee-rev_90s_linear_infinite]'
              : 'motion-safe:animate-[cp-marquee_90s_linear_infinite]'
          }`}
        >
          {list.map((t) => card(t, 0))}
          {list.map((t) => card(t, 1))}
        </ul>
      </div>
    );
  };
  return (
    <section
      id="showcase"
      className={`scroll-mt-16 overflow-hidden ${ink} py-20 text-white sm:py-24`}
    >
      <div className={`${container} flex flex-wrap items-end justify-between gap-6`}>
        <h2 className={`max-w-2xl ${headline}`}>
          Stores you could open <Green dark>today</Green>
        </h2>
        <a href="/templates" className={`group ${buttonLight}`}>
          Browse all {THEME_TEMPLATES.length} templates <Arrow />
        </a>
      </div>
      <div className="mt-12 space-y-8">
        {row(byIndustry(0), false)}
        {row(byIndustry(5), true)}
      </div>
    </section>
  );
}

// ── How it works ────────────────────────────────────────────────────────────────

export function HowItWorks() {
  const steps: { title: string; body: string; visual: ReactNode }[] = [
    {
      title: 'Create your store',
      body: 'Sign up, verify your email and pick a template for your industry. Your store gets its own address straight away.',
      visual: (
        <div className="space-y-2">
          <div className="rounded-md bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-900/10">
            yourbrand
            <span className="text-slate-400">.yourplatform.com</span>
          </div>
          <div className="rounded-md bg-azure-600 py-2 text-center text-xs font-semibold text-white">
            Create store
          </div>
        </div>
      ),
    },
    {
      title: 'Add your products',
      body: 'Add products with photos and variants by hand, or import your whole catalog from a CSV file.',
      visual: (
        <div className="space-y-2 text-xs">
          {['Linen shirt · 5 variants', 'Canvas tote · 2 variants'].map((p) => (
            <div
              key={p}
              className="flex items-center gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-slate-900/10"
            >
              <span className="size-5 rounded bg-azure-100" />
              <span className="font-medium text-navy-900">{p}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Connect payments & launch',
      body: 'Connect Stripe or Razorpay, set shipping and taxes, test in the sandbox and open your doors.',
      visual: (
        <div className="flex items-center justify-between rounded-md bg-white px-3 py-2.5 text-xs ring-1 ring-slate-900/10">
          <span className="font-medium text-navy-900">Store status</span>
          <span className="rounded-full bg-leaf-500/15 px-2 py-0.5 font-semibold text-leaf-600">
            ● Live
          </span>
        </div>
      ),
    },
  ];
  return (
    <section id="how-it-works" className={`scroll-mt-16 bg-white ${section}`}>
      <div className={container}>
        <h2 className={`max-w-2xl text-navy-900 ${headline}`}>Live in three steps</h2>
        <ol className="mt-12 grid gap-5 lg:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="relative flex flex-col overflow-hidden rounded-xl bg-mist p-7 ring-1 ring-slate-900/[0.05]"
            >
              <span
                aria-hidden="true"
                className={`absolute -top-6 -right-2 text-[8rem] leading-none font-semibold text-azure-600/[0.07] ${displayFace}`}
              >
                {i + 1}
              </span>
              <span className="flex size-9 items-center justify-center rounded-md bg-navy-950 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h3 className={`mt-5 text-xl font-semibold text-navy-900 ${displayFace}`}>
                {s.title}
              </h3>
              <p className="mt-2 leading-7 text-slate-600">{s.body}</p>
              <div aria-hidden="true" className="mt-6 pt-2">
                {s.visual}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a href={signupUrl} className={`group ${buttonPrimary}`}>
            Start free trial <Arrow />
          </a>
          <a href="/guides" className={buttonSecondary}>
            Read the setup guides
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Pricing teaser ──────────────────────────────────────────────────────────────

const usd = (cents: number) =>
  cents === 0
    ? 'Free'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
      }).format(cents / 100);
const percent = (bps: number) =>
  `${(bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;

/** The live plans from the API (hidden when they cannot be loaded). */
export async function PricingTeaser() {
  const plans = await fetchPublicPlans();
  if (!plans) return null;
  const featured = plans.length > 1 ? Math.floor(plans.length / 2) : -1;
  return (
    <section id="plans" className={`scroll-mt-16 bg-white ${section}`}>
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className={`text-navy-900 ${headline}`}>
              Simple pricing, <Green>every feature included</Green>
            </h2>
            <p className={`mt-5 max-w-2xl text-slate-600 ${lead}`}>
              Plans differ only in limits and the platform fee on sales. Every new store starts with
              a 14-day trial.
            </p>
          </div>
          <a href="/pricing" className={`group ${buttonSecondary}`}>
            Compare plans <Arrow />
          </a>
        </div>
        <ul
          className={`mt-12 grid gap-5 ${plans.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}
        >
          {plans.map((plan, i) => {
            const hi = i === featured;
            return (
              <li
                key={plan.code}
                className={`flex flex-col rounded-xl p-7 ${
                  hi
                    ? 'bg-navy-950 text-white shadow-[0_30px_60px_-30px_rgb(10_34_54/0.7)]'
                    : 'bg-mist text-navy-900 ring-1 ring-slate-900/[0.05]'
                }`}
              >
                <p className="flex items-center justify-between font-semibold">
                  {plan.name}
                  {hi ? (
                    <span className="rounded-full bg-leaf-500/20 px-2.5 py-0.5 text-xs font-semibold text-leaf-300">
                      Recommended
                    </span>
                  ) : null}
                </p>
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className={`text-4xl font-medium tracking-[-0.03em] ${displayFace}`}>
                    {usd(plan.priceMonthly)}
                  </span>
                  {plan.priceMonthly > 0 ? (
                    <span className={hi ? 'text-slate-400' : 'text-slate-500'}>/month</span>
                  ) : null}
                </p>
                <p className={`mt-3 text-sm ${hi ? 'text-slate-300' : 'text-slate-600'}`}>
                  {plan.maxProducts === null
                    ? 'Unlimited products'
                    : `Up to ${plan.maxProducts.toLocaleString('en-US')} products`}{' '}
                  ·{' '}
                  {plan.transactionFeeBps === 0
                    ? 'no platform fee'
                    : `${percent(plan.transactionFeeBps)} platform fee`}
                </p>
                <a
                  href={signupUrl}
                  className={`mt-7 rounded-md px-4 py-2.5 text-center text-sm font-semibold transition ${focusRing} ${
                    hi
                      ? 'bg-white text-navy-900 hover:bg-azure-50'
                      : 'bg-azure-600 text-white hover:bg-azure-700'
                  }`}
                >
                  Start with {plan.name}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
