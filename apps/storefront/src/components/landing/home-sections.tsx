/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import {
  findThemeTemplate,
  THEME_INDUSTRIES,
  THEME_TEMPLATES,
  type ThemeTemplate,
} from '@repo/contracts';
import type { ReactNode } from 'react';
import { EmailCapture } from './email-capture';
import { Faq } from './faq';
import { HeroVisual } from './hero-visual';
import { Icon, type IconName } from './icons';
import { IndustryTabs } from './industry-tabs';
import {
  Arrow,
  buttonLight,
  buttonPrimary,
  container,
  display,
  displayFace,
  focusRing,
  glass,
  glassDark,
  headline,
  ink,
  lead,
  paper,
  section,
  textLink,
} from './page-parts';
import { IndustryImage, industryPhoto, Photo, type PhotoName } from './photos';
import { SuiteTabs } from './suite-tabs';
import { TemplateThumb } from './template-thumb';
import { apiDocsUrl, signupUrl } from './urls';

const TEMPLATE_COUNT = THEME_TEMPLATES.length;
const INDUSTRY_COUNT = THEME_INDUSTRIES.length;

/** What a store in each industry sells (for "Sell … online"). */
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

/** A phrase picked out in the accent color inside a heading. */
function Blue({ children }: { children: ReactNode }) {
  return <span className="text-azure-600">{children}</span>;
}
function Green({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <span className={dark ? 'text-leaf-400' : 'text-leaf-500'}>{children}</span>;
}

// ── Hero ────────────────────────────────────────────────────────────────────────

const INTENTS: { icon: IconName; label: string; href: string }[] = [
  { icon: 'rocket', label: 'Launch a store', href: '/templates' },
  { icon: 'card', label: 'Accept payments', href: '/features/payments' },
  { icon: 'globe', label: 'Sell in many currencies', href: '/features/international' },
  { icon: 'box', label: 'Manage orders', href: '/features/orders' },
  { icon: 'tag', label: 'Run discounts', href: '/features/marketing' },
  { icon: 'code', label: 'Build on the API', href: '/features/developers' },
];

export function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden bg-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_34rem_at_100%_0%,rgb(223_232_255/0.9),transparent_70%),linear-gradient(to_bottom,white,rgb(242_245_249))]"
      />
      <div
        className={`${container} grid items-center gap-12 pt-12 pb-12 sm:pt-16 lg:grid-cols-[1fr_1.08fr] lg:gap-10 lg:pt-20 lg:pb-16`}
      >
        <div>
          <h1 className={`text-navy-900 ${display}`}>
            <Blue>Your online store,</Blue>
            <br />
            ready to sell today
          </h1>
          <p className={`mt-6 max-w-xl text-slate-600 ${lead}`}>
            Pick one of {TEMPLATE_COUNT} templates, take payments with Stripe or Razorpay, and run
            orders, stock and customers from one admin.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a href={signupUrl} className={`group ${buttonPrimary} px-6`}>
              Start free trial <Arrow />
            </a>
            <a href="/templates" className={`group inline-flex items-center gap-1 ${textLink}`}>
              Explore templates <Arrow />
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500">Every new store starts with a 14-day trial.</p>
        </div>
        <HeroVisual />
      </div>

      {/* "What do you want to do?" — a quick way into the right part of the site. */}
      <div className={`${container} pb-14 sm:pb-16`}>
        <div className="flex flex-col gap-4 rounded-xl bg-white/90 p-4 shadow-[0_12px_40px_-16px_rgb(10_34_54/0.25)] ring-1 ring-slate-900/[0.07] backdrop-blur-xl sm:p-5 lg:flex-row lg:items-center lg:gap-6">
          <p className="flex shrink-0 items-center gap-2 font-medium text-navy-900">
            <span className="flex size-7 items-center justify-center rounded-md bg-azure-600 text-white">
              <Icon name="rocket" className="size-4" />
            </span>
            What do you want to do?
          </p>
          <ul className="flex flex-wrap gap-2">
            {INTENTS.map((intent) => (
              <li key={intent.label}>
                <a
                  href={intent.href}
                  className={`inline-flex items-center gap-1.5 rounded-md bg-azure-50 px-3 py-1.5 text-sm font-medium text-azure-700 ring-1 ring-azure-600/10 transition hover:bg-azure-100 ${focusRing}`}
                >
                  <Icon name={intent.icon} className="size-4" />
                  {intent.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── Industries strip ────────────────────────────────────────────────────────────

/** A slow, logo-wall style strip of the industries the templates are made for. */
export function IndustryStrip() {
  const item = (label: string, copy: number) => (
    <li
      key={`${label}-${copy}`}
      aria-hidden={copy > 0 || undefined}
      className={`flex shrink-0 items-center gap-10 text-2xl font-semibold tracking-[-0.02em] text-slate-400 sm:text-[1.75rem] ${displayFace}`}
    >
      {label}
      <span aria-hidden="true" className="size-1.5 rounded-full bg-slate-300" />
    </li>
  );
  return (
    <section aria-label="Industries" className="border-y border-slate-900/[0.06] bg-white py-7">
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:overflow-x-auto">
        <ul className="flex w-max gap-10 hover:[animation-play-state:paused] motion-safe:animate-[cp-marquee_60s_linear_infinite]">
          {THEME_INDUSTRIES.map((i) => item(i.label, 0))}
          {THEME_INDUSTRIES.map((i) => item(i.label, 1))}
        </ul>
      </div>
    </section>
  );
}

// ── Promo banner ────────────────────────────────────────────────────────────────

export function SwitchBanner() {
  return (
    <section className={`${paper} pt-16 sm:pt-20`}>
      <div className={container}>
        <div
          className={`relative isolate grid overflow-hidden rounded-xl ${ink} text-white lg:grid-cols-[1.05fr_1fr]`}
        >
          <div className="absolute inset-y-0 right-0 -z-20 w-full lg:w-[60%]">
            <Photo name="shipping-boxes" alt="" position="center 40%" />
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(10_34_54)_0%,rgb(10_34_54/0.96)_38%,rgb(10_34_54/0.55)_70%,rgb(10_34_54/0.2)_100%)]"
          />
          <div className="px-6 py-10 sm:px-10 sm:py-12">
            <p className="text-xs font-semibold tracking-[0.18em] text-azure-200 uppercase">
              Switch to us
            </p>
            <h2
              className={`mt-4 text-[1.75rem] leading-[1.12] font-medium tracking-[-0.02em] sm:text-4xl ${displayFace}`}
            >
              Moving from another platform? Bring your whole catalog.
            </h2>
            <p className="mt-4 max-w-md leading-7 text-slate-300">
              Import products from a Shopify-style CSV, one row per variant, then follow the launch
              checklist.
            </p>
            <a href="/switch" className={`group mt-8 ${buttonLight} !py-2.5`}>
              See how to switch <Arrow />
            </a>
          </div>
          <div aria-hidden="true" className="hidden items-end justify-end p-8 lg:flex">
            <div className={`w-64 rounded-xl p-4 text-white ${glassDark}`}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="file" className="size-4 text-azure-200" />
                products.csv
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-full rounded-full bg-leaf-400" />
              </div>
              <p className="mt-2 text-xs text-slate-200">248 rows · 96 products imported</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── All-in-one platform: sticky tabs over stacked panels ────────────────────────

/** The tinted picture area at the top of a product card. */
function Visual({
  tone = 'blue',
  photo,
  children,
}: {
  tone?: 'blue' | 'teal';
  photo?: PhotoName;
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative isolate flex aspect-[4/3] items-center justify-center overflow-hidden p-5 ${
        tone === 'blue' ? 'bg-[#dde7fb]' : 'bg-[#d8ebf0]'
      }`}
    >
      {photo ? (
        <div className="absolute inset-0 -z-20">
          <Photo name={photo} alt="" />
        </div>
      ) : (
        <>
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(rgb(10_34_54/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(10_34_54/0.05)_1px,transparent_1px)] bg-[size:18px_18px]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-azure-500/45 to-transparent" />
        </>
      )}
      {children}
    </div>
  );
}

/** A small white UI card inside a Visual. */
function Mini({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`w-full max-w-[15rem] rounded-lg bg-white/95 p-3 text-[12px] text-navy-900 shadow-[0_12px_30px_-12px_rgb(10_34_54/0.35)] ring-1 ring-slate-900/[0.06] ${className}`}
    >
      {children}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? 'font-semibold' : 'text-slate-600'}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Pill({ children, on = false }: { children: ReactNode; on?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${on ? 'bg-azure-600 text-white' : 'bg-white/90 text-navy-900 ring-1 ring-slate-900/[0.06]'}`}
    >
      {children}
    </span>
  );
}

interface ProductCard {
  title: string;
  body: string;
  href: string;
  visual: ReactNode;
}

interface Panel {
  id: string;
  tab: string;
  cards: ProductCard[];
}

function panels(): Panel[] {
  const store = findThemeTemplate('home-catalog') ?? THEME_TEMPLATES[0];
  return [
    {
      id: 'build',
      tab: 'Build your store',
      cards: [
        {
          title: 'Templates',
          body: `${TEMPLATE_COUNT} designs for ${INDUSTRY_COUNT} industries. Switch any time and keep your content.`,
          href: '/templates',
          visual: (
            <Visual>
              {store ? (
                <div className="w-[82%] overflow-hidden rounded-lg shadow-[0_16px_40px_-16px_rgb(10_34_54/0.5)] ring-1 ring-slate-900/10">
                  <TemplateThumb template={store} tiles={3} scale={8} className="h-36" />
                </div>
              ) : null}
            </Visual>
          ),
        },
        {
          title: 'Pages, blog & menus',
          body: 'Your own pages, a blog, navigation menus, policies and a password page for pre-launch.',
          href: '/features/online-store',
          visual: (
            <Visual tone="teal">
              <div className="flex w-full max-w-[14rem] flex-col gap-2">
                {['About us', 'Shipping & returns', 'Journal · New arrivals', 'Refund policy'].map(
                  (p, i) => (
                    <span
                      key={p}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium ${
                        i === 2
                          ? 'bg-azure-600 text-white shadow-lg'
                          : 'bg-white/90 text-navy-900 ring-1 ring-slate-900/[0.06]'
                      }`}
                    >
                      <Icon name="file" className="size-3.5" />
                      {p}
                    </span>
                  ),
                )}
              </div>
            </Visual>
          ),
        },
        {
          title: 'Custom domains',
          body: 'Every store gets its own address, and you can connect a domain you own with automatic HTTPS.',
          href: '/features/domains',
          visual: (
            <Visual photo="laptop-shop-counter">
              <div
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] ${glass}`}
              >
                <Icon name="lock" className="size-4 text-leaf-600" />
                <span className="font-semibold text-navy-900">yourstore.com</span>
                <span className="rounded-full bg-leaf-500/15 px-1.5 text-[10px] font-semibold text-leaf-600">
                  HTTPS
                </span>
              </div>
            </Visual>
          ),
        },
        {
          title: 'Design settings',
          body: 'Change colors, fonts, homepage sections and wording from your admin — no code needed.',
          href: '/features/online-store',
          visual: (
            <Visual tone="teal">
              <Mini>
                <p className="font-semibold">Theme</p>
                <div className="mt-2 flex gap-1.5">
                  {['#192839', '#305eff', '#16a35f', '#f59e0b', '#f2f5f9'].map((c) => (
                    <span
                      key={c}
                      className="size-6 rounded-full ring-1 ring-slate-900/10"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-2">
                  <span className={`text-base font-semibold ${displayFace}`}>Aa</span>
                  <span className="text-slate-500">Heading font</span>
                </div>
              </Mini>
            </Visual>
          ),
        },
      ],
    },
    {
      id: 'sell',
      tab: 'Sell & get paid',
      cards: [
        {
          title: 'Checkout',
          body: 'Prices, discounts, shipping and taxes are worked out on the server for every order.',
          href: '/features/checkout',
          visual: (
            <Visual>
              <Mini>
                <Row k="Subtotal" v="$80.00" />
                <Row k="WELCOME10" v="−$8.00" />
                <Row k="Shipping" v="$5.00" />
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <Row k="Total" v="$77.00" strong />
                </div>
                <div className="mt-2 rounded-md bg-azure-600 py-1.5 text-center font-semibold text-white">
                  Pay now
                </div>
              </Mini>
            </Visual>
          ),
        },
        {
          title: 'Stripe & Razorpay',
          body: 'Payouts go straight to your own account. Test every flow first in the payment sandbox.',
          href: '/features/payments',
          visual: (
            <Visual photo="card-payment">
              <div className={`rounded-xl px-4 py-3 text-[12px] text-navy-900 ${glass}`}>
                <p className="text-slate-600">Payment received</p>
                <p className={`mt-0.5 text-lg font-semibold ${displayFace}`}>₹2,499.00</p>
              </div>
            </Visual>
          ),
        },
        {
          title: 'Multi-currency',
          body: 'Shoppers pick a currency and pay in it, at your own exchange rates and rounding.',
          href: '/features/international',
          visual: (
            <Visual tone="teal">
              <div className="flex max-w-[15rem] flex-wrap justify-center gap-2">
                {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'].map((c, i) => (
                  <Pill key={c} on={i === 3}>
                    {c}
                  </Pill>
                ))}
              </div>
            </Visual>
          ),
        },
        {
          title: 'Discounts & gift cards',
          body: 'Codes with schedules and usage limits, and gift cards shoppers redeem at checkout.',
          href: '/features/marketing',
          visual: (
            <Visual>
              <Mini>
                <div className="flex gap-1.5">
                  <span className="flex-1 rounded-md px-2.5 py-1.5 text-slate-500 ring-1 ring-slate-200">
                    SPRING15
                  </span>
                  <span className="rounded-md bg-navy-950 px-2.5 py-1.5 font-semibold text-white">
                    Apply
                  </span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 font-medium text-leaf-600">
                  <Icon name="tag" className="size-3.5" />
                  15% off applied
                </p>
                <Row k="Gift card" v="−$20.00" />
              </Mini>
            </Visual>
          ),
        },
      ],
    },
    {
      id: 'run',
      tab: 'Run your business',
      cards: [
        {
          title: 'Orders & fulfilment',
          body: 'Fulfil with tracking numbers, print packing slips and create draft orders and invoices.',
          href: '/features/orders',
          visual: (
            <Visual photo="packing-orders">
              <div className={`w-52 rounded-xl p-3 text-[12px] text-navy-900 ${glass}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Order #1042</span>
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    Unfulfilled
                  </span>
                </div>
                <div className="mt-2 rounded-md bg-navy-950 py-1.5 text-center font-semibold text-white">
                  Mark as fulfilled
                </div>
              </div>
            </Visual>
          ),
        },
        {
          title: 'Inventory & locations',
          body: 'Stock per variant and per location, with transfers and low-stock filters.',
          href: '/features/inventory',
          visual: (
            <Visual tone="teal">
              <Mini>
                <p className="font-semibold">Linen shirt · M</p>
                {[
                  ['Warehouse', '42'],
                  ['Shop floor', '8'],
                  ['Pop-up', '3'],
                ].map(([k, v]) => (
                  <Row key={k} k={k!} v={v!} />
                ))}
              </Mini>
            </Visual>
          ),
        },
        {
          title: 'Returns & refunds',
          body: 'Customers request returns from their account; you approve them and refund the payment.',
          href: '/features/orders',
          visual: (
            <Visual>
              <Mini>
                <p className="font-semibold">Return requested</p>
                <p className="text-slate-500">1 item · within 30 days</p>
                <div className="mt-2 flex gap-1.5">
                  <span className="rounded-md bg-leaf-500 px-2.5 py-1 font-semibold text-white">
                    Approve
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                    Decline
                  </span>
                </div>
              </Mini>
            </Visual>
          ),
        },
        {
          title: 'Staff & permissions',
          body: 'Invite staff with only the permissions they need, protected by two-factor sign-in.',
          href: '/features/staff-security',
          visual: (
            <Visual tone="teal">
              <Mini>
                {[
                  ['Owner', 'All access'],
                  ['Packer', 'Orders'],
                  ['Writer', 'Products'],
                ].map(([role, scope]) => (
                  <div
                    key={role}
                    className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0"
                  >
                    <span className="font-medium">{role}</span>
                    <span className="rounded-full bg-azure-50 px-2 py-0.5 text-[10px] font-semibold text-azure-700">
                      {scope}
                    </span>
                  </div>
                ))}
              </Mini>
            </Visual>
          ),
        },
      ],
    },
    {
      id: 'grow',
      tab: 'Grow sales',
      cards: [
        {
          title: 'Abandoned checkout emails',
          body: 'Remind shoppers who left checkout unfinished, with a link back to their cart.',
          href: '/features/marketing',
          visual: (
            <Visual>
              <Mini>
                <p className="flex items-center gap-1.5 font-semibold">
                  <Icon name="mail" className="size-3.5 text-azure-600" />
                  You left something behind
                </p>
                <p className="mt-1 text-slate-500">Your cart is saved — finish your order.</p>
                <div className="mt-2 rounded-md bg-azure-600 py-1.5 text-center font-semibold text-white">
                  Return to cart
                </div>
              </Mini>
            </Visual>
          ),
        },
        {
          title: 'Customer segments',
          body: 'Group customers by what they spend and order, then reach the right people.',
          href: '/features/marketing',
          visual: (
            <Visual photo="phone-shopping">
              <div className={`rounded-xl px-4 py-3 text-[12px] text-navy-900 ${glass}`}>
                <p className="text-slate-600">Segment</p>
                <p className="mt-0.5 font-semibold">Spent over $200 · 318 customers</p>
              </div>
            </Visual>
          ),
        },
        {
          title: 'Analytics',
          body: 'Sales, orders and top products by day, on the dashboard your admin opens with.',
          href: '/features/analytics',
          visual: (
            <Visual tone="teal">
              <Mini>
                <p className="text-slate-500">Net sales · 7 days</p>
                <p className={`text-lg font-semibold ${displayFace}`}>$8,940.20</p>
                <div className="mt-2 flex h-12 items-end gap-1">
                  {[30, 46, 38, 60, 52, 74, 90].map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-azure-600 to-azure-300"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </Mini>
            </Visual>
          ),
        },
        {
          title: 'Search-friendly pages',
          body: 'SEO titles and descriptions for products and pages, plus a sitemap for every store.',
          href: '/features/online-store',
          visual: (
            <Visual>
              <Mini>
                <p className="text-[11px] text-leaf-600">yourstore.com › products › linen-shirt</p>
                <p className="mt-0.5 font-semibold text-azure-700">
                  Linen shirt — breathable summer fit
                </p>
                <p className="mt-0.5 text-slate-500">
                  Relaxed linen shirt in five colors. Free returns within 30 days.
                </p>
              </Mini>
            </Visual>
          ),
        },
      ],
    },
  ];
}

export function PlatformSuite() {
  const list = panels();
  return (
    <section id="platform" className={`scroll-mt-16 ${paper} pt-20 pb-14 sm:pt-24 sm:pb-20`}>
      <div className={container}>
        <h2 className={`max-w-4xl text-navy-900 ${headline}`}>
          The all-in-one <Green>commerce platform</Green> you&rsquo;ve been looking for
        </h2>
        <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.9375rem] text-slate-600">
          <span className="border-r border-slate-300 pr-5">With Commerce Platform, you can:</span>
          {list.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className={`rounded font-semibold text-navy-900 hover:text-azure-700 ${focusRing}`}
            >
              {p.tab}
            </a>
          ))}
        </p>

        <div className="mt-10">
          <SuiteTabs
            tabs={list.map((p) => ({ id: p.id, label: p.tab }))}
            cta={{ label: 'Start free trial', href: signupUrl }}
          />
          <div className="mt-8">
            {list.map((panel, i) => (
              <article
                key={panel.id}
                id={panel.id}
                aria-labelledby={`${panel.id}-title`}
                className="mb-6 scroll-mt-36 rounded-xl bg-white p-6 shadow-[0_-12px_40px_-24px_rgb(10_34_54/0.35)] ring-1 ring-slate-900/[0.05] sm:p-8 lg:sticky lg:mb-10 lg:p-10"
                style={{ top: `calc(8.5rem + ${i * 0.9}rem)` }}
              >
                <h3
                  id={`${panel.id}-title`}
                  className={`text-2xl font-semibold tracking-[-0.02em] text-navy-900 sm:text-[1.75rem] ${displayFace}`}
                >
                  {panel.tab}
                </h3>
                <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {panel.cards.map((card) => (
                    <li key={card.title} className="flex">
                      <a
                        href={card.href}
                        className={`group flex flex-1 flex-col overflow-hidden rounded-lg bg-white ring-1 ring-slate-900/[0.08] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgb(10_34_54/0.35)] ${focusRing}`}
                      >
                        {card.visual}
                        <span className="flex flex-1 flex-col p-4">
                          <span className="font-semibold text-navy-900 group-hover:text-azure-700">
                            {card.title}
                          </span>
                          <span className="mt-1.5 text-sm leading-6 text-slate-600">
                            {card.body}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Every industry ──────────────────────────────────────────────────────────────

export function IndustriesTabs() {
  const tabs = THEME_INDUSTRIES.map((i) => ({ id: i.id, label: i.label }));
  const panelsFor = THEME_INDUSTRIES.map((industry) => {
    const list = THEME_TEMPLATES.filter((t) => t.industry === industry.id);
    const word = INDUSTRY_WORDS[industry.id] ?? industry.label.toLowerCase();
    return (
      <div key={industry.id} className="relative isolate overflow-hidden rounded-xl">
        <div className="absolute inset-0 -z-20">
          <IndustryImage src={industryPhoto(industry.id)} />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/40 via-navy-950/10 to-transparent"
        />
        <div className="p-4 sm:p-8 lg:p-10">
          <div className="max-w-lg rounded-xl bg-white/90 p-6 shadow-[0_24px_60px_-24px_rgb(10_34_54/0.5)] ring-1 ring-white/60 backdrop-blur-xl sm:p-8">
            <h3
              className={`text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-navy-900 sm:text-4xl ${displayFace}`}
            >
              Sell {word}
              <br />
              <Green>online, beautifully</Green>
            </h3>
            <p className="mt-4 leading-7 text-slate-600">
              {list.length} templates made for {industry.label.toLowerCase()} stores, with photos,
              colors and wording to match what you sell. Start from one and make it yours.
            </p>
            <ul aria-hidden="true" className="mt-6 grid grid-cols-3 gap-2">
              {list.slice(0, 3).map((t: ThemeTemplate) => (
                <li key={t.id} className="overflow-hidden rounded-md ring-1 ring-slate-900/10">
                  <TemplateThumb template={t} tiles={2} scale={10} className="h-20" />
                </li>
              ))}
            </ul>
            <a
              href={`/templates?industry=${industry.id}`}
              className={`group mt-7 ${buttonPrimary} !py-2.5`}
            >
              See {industry.label.toLowerCase()} templates <Arrow />
            </a>
          </div>
        </div>
      </div>
    );
  });
  return (
    <section id="industries" className={`scroll-mt-16 bg-white ${section}`}>
      <div className={container}>
        <h2 className={`max-w-3xl text-navy-900 ${headline}`}>
          Made for every industry.
          <br />
          Ready for every store.
        </h2>
        <div className="mt-10">
          <IndustryTabs tabs={tabs} panels={panelsFor} />
        </div>
      </div>
    </section>
  );
}

// ── Statements ──────────────────────────────────────────────────────────────────

export function Statements() {
  return (
    <section className={`${paper} ${section}`}>
      <div className={container}>
        <h2
          className={`max-w-3xl text-[1.75rem] leading-tight font-medium tracking-[-0.02em] text-navy-900 sm:text-4xl ${displayFace}`}
        >
          Built carefully, so your store just works.
        </h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <article className="flex flex-col rounded-xl bg-white p-7 ring-1 ring-slate-900/[0.06] sm:p-10">
            <p className="flex items-center justify-between text-sm font-medium text-slate-600">
              Checkout
              <Icon name="lock" className="size-5 text-navy-900" />
            </p>
            <p
              className={`mt-6 text-[1.75rem] leading-[1.2] font-medium tracking-[-0.02em] text-navy-900 sm:text-[2.5rem] ${displayFace}`}
            >
              <Blue>Every price, discount and tax is worked out on the server,</Blue> never trusted
              from the browser.
            </p>
            <p className="mt-6 max-w-xl leading-7 text-slate-600">
              Card details are entered on Stripe or Razorpay&rsquo;s hosted page, so they never
              touch our servers.
            </p>
            <a
              href="/features/checkout"
              className={`group mt-auto inline-flex items-center gap-1 pt-8 text-sm ${textLink}`}
            >
              How checkout works <Arrow />
            </a>
          </article>
          <div className="grid gap-5">
            <article className="rounded-xl bg-white p-7 ring-1 ring-slate-900/[0.06]">
              <p className="text-sm font-medium text-slate-600">Templates</p>
              <p
                className={`mt-4 text-xl leading-snug font-medium tracking-[-0.01em] text-navy-900 sm:text-2xl ${displayFace}`}
              >
                <Blue>Switch templates any time</Blue> — your products, pages and headlines stay as
                they are.
              </p>
            </article>
            <article className={`rounded-xl ${ink} p-7 text-white`}>
              <p className="text-sm font-medium text-slate-300">Security</p>
              <p
                className={`mt-4 text-xl leading-snug font-medium tracking-[-0.01em] sm:text-2xl ${displayFace}`}
              >
                <Green dark>Each store&rsquo;s data is isolated</Green> at the database level, with
                two-factor sign-in for staff.
              </p>
              <a
                href="/security"
                className="group mt-5 inline-flex items-center gap-1 rounded text-sm font-semibold text-azure-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                How we protect stores <Arrow />
              </a>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Developers ──────────────────────────────────────────────────────────────────

const DEV_WORDS = ['REST API', 'WEBHOOKS', 'OPENAPI', 'ACCESS TOKENS', 'CSV IMPORT', 'CSV EXPORT'];

export function Developers() {
  const tiles: { icon: IconName; title: string; body: string; href: string; external?: boolean }[] =
    [
      {
        icon: 'code',
        title: 'Admin API tokens',
        body: 'Store-scoped tokens with only the permissions you grant, revocable any time.',
        href: '/features/developers',
      },
      {
        icon: 'link',
        title: 'Signed webhooks',
        body: 'Order and product events delivered with a signature to verify, and automatic retries.',
        href: '/features/developers',
      },
      {
        icon: 'file',
        title: 'API reference',
        body: 'The REST API is described in an OpenAPI document you can browse in your browser.',
        href: apiDocsUrl,
        external: true,
      },
    ];
  const band = (copy: number) =>
    DEV_WORDS.map((w) => (
      <li
        key={`${w}-${copy}`}
        aria-hidden={copy > 0 || undefined}
        className="flex shrink-0 items-center gap-6"
      >
        {w}
        <span aria-hidden="true" className="size-1.5 rounded-full bg-navy-950" />
      </li>
    ));
  return (
    <section id="developers" className={`scroll-mt-16 ${ink} text-white`}>
      <div className="overflow-hidden bg-leaf-500 py-3 text-navy-950">
        <ul className="flex w-max gap-6 text-lg font-bold tracking-wide motion-safe:animate-[cp-marquee_40s_linear_infinite]">
          {band(0)}
          {band(1)}
          {band(2)}
          {band(3)}
        </ul>
      </div>
      <div className={`${container} ${section}`}>
        <h2 className={headline}>
          Commerce Platform is built
          <br />
          <Green dark>&lt;for developers, too&gt;</Green>
        </h2>
        <ul className="mt-12 grid gap-10 sm:grid-cols-3">
          {tiles.map((t) => (
            <li key={t.title}>
              <Icon name={t.icon} className="size-6 text-white" />
              <h3 className="mt-4 font-semibold">{t.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t.body}</p>
              <a
                href={t.href}
                {...(t.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="group mt-4 inline-flex items-center gap-1 rounded text-sm font-semibold text-white hover:text-leaf-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t.external ? 'View docs' : 'Learn more'}
                {t.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                <Arrow />
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-16 grid items-start gap-8 lg:grid-cols-[1fr_2fr]">
          <p className={`text-2xl leading-tight font-medium sm:text-3xl ${displayFace}`}>
            See an order
            <br />
            webhook <span aria-hidden="true">↘</span>
          </p>
          <div
            aria-hidden="true"
            className="min-w-0 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/10"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-slate-400">
              <span className="rounded-md bg-white/10 px-2 py-1 font-semibold text-white">
                Webhook
              </span>
              <span className="rounded bg-leaf-500/15 px-1.5 py-0.5 font-semibold text-leaf-300">
                POST
              </span>
              <span className="truncate">https://example.com/hooks</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-slate-300 sm:p-6">
              <code>
                <span className="text-slate-500">{'// headers'}</span>
                {'\n'}
                <span className="text-azure-300">x-commerce-topic</span>: orders/paid{'\n'}
                <span className="text-azure-300">x-commerce-hmac-sha256</span>: 3q2+7w…{'\n\n'}
                <span className="text-slate-500">{'// body'}</span>
                {'\n'}
                {'{\n  '}
                <span className="text-azure-200">&quot;id&quot;</span>
                {': '}
                <span className="text-leaf-300">&quot;0193…&quot;</span>
                {',\n  '}
                <span className="text-azure-200">&quot;number&quot;</span>
                {': '}
                <span className="text-amber-200">1042</span>
                {',\n  '}
                <span className="text-azure-200">&quot;total&quot;</span>
                {': '}
                <span className="text-amber-200">8318</span>
                {',\n  '}
                <span className="text-azure-200">&quot;currency&quot;</span>
                {': '}
                <span className="text-leaf-300">&quot;USD&quot;</span>
                {'\n}'}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FAQ & closing ───────────────────────────────────────────────────────────────

export function HomeFaq() {
  return <Faq />;
}

export function GetStarted() {
  return (
    <section id="get-started" className="scroll-mt-16 bg-white">
      <div
        className={`${container} grid items-center gap-10 py-20 sm:py-24 lg:grid-cols-[1.2fr_1fr]`}
      >
        <div>
          <h2 className={`text-navy-900 ${headline}`}>
            Start selling with
            <br />
            <Blue>Commerce Platform</Blue>
          </h2>
          <p className={`mt-5 max-w-xl text-slate-600 ${lead}`}>
            Pick a template, add your products and connect payments. Your store can be live today.
          </p>
        </div>
        <div className="lg:justify-self-end">
          <EmailCapture signupUrl={signupUrl} tone="light" />
          <p className="mt-3 text-sm text-slate-500">Every new store starts with a 14-day trial.</p>
        </div>
      </div>
    </section>
  );
}
