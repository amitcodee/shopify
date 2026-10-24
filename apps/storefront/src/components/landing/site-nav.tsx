'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */

import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';
import { Logo } from './logo';
import { Photo, type PhotoName } from './photos';
import type { MarketingLinks } from './urls';

type MenuId = 'why' | 'products' | 'resources';

interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

interface NavGroup {
  title: string;
  icon: IconName;
  items: NavLink[];
}

interface NavCard {
  title: string;
  body: string;
  href: string;
  icon: IconName;
  external?: boolean;
  photo?: PhotoName;
}

const WHY_US: NavCard[] = [
  {
    title: 'Templates for every industry',
    body: '108 designs for 12 industries. Pick one when you sign up and open your store the same day.',
    href: '/templates',
    icon: 'rocket',
    photo: 'boutique-interior',
  },
  {
    title: 'Switch from another platform',
    body: 'Bring your catalog over with a Shopify-style product CSV, then follow the launch checklist.',
    href: '/switch',
    icon: 'switch',
    photo: 'shipping-boxes',
  },
  {
    title: 'Security built in',
    body: 'Database-level store isolation, hosted card payments and two-factor sign-in for staff.',
    href: '/security',
    icon: 'shield',
    photo: 'team-planning',
  },
];

const PRODUCT_GROUPS: NavGroup[] = [
  {
    title: 'Build your website',
    icon: 'layout',
    items: [
      { label: 'Templates', href: '/templates' },
      { label: 'Online store pages & blog', href: '/features/online-store' },
      { label: 'Custom domains', href: '/features/domains' },
    ],
  },
  {
    title: 'Sell anywhere',
    icon: 'globe',
    items: [
      { label: 'Checkout', href: '/features/checkout' },
      { label: 'Multi-currency', href: '/features/international' },
      { label: 'Draft orders & invoices', href: '/features/orders' },
    ],
  },
  {
    title: 'Marketing & analytics',
    icon: 'chart',
    items: [
      { label: 'Discounts & gift cards', href: '/features/marketing' },
      { label: 'Customer segments', href: '/features/marketing' },
      { label: 'Abandoned checkout emails', href: '/features/checkout' },
      { label: 'Analytics', href: '/features/analytics' },
    ],
  },
  {
    title: 'Run your business',
    icon: 'truck',
    items: [
      { label: 'Products & inventory', href: '/features/inventory' },
      { label: 'Orders, returns & packing slips', href: '/features/orders' },
      { label: 'Staff & permissions', href: '/features/staff-security' },
    ],
  },
  {
    title: 'Get paid',
    icon: 'card',
    items: [
      { label: 'Stripe Connect', href: '/features/payments' },
      { label: 'Razorpay', href: '/features/payments' },
      { label: 'Refunds & chargebacks', href: '/features/payments' },
    ],
  },
];

function extendGroup(links: MarketingLinks): NavGroup {
  return {
    title: 'Customize & extend',
    icon: 'code',
    items: [
      { label: 'Developer features', href: '/features/developers' },
      { label: 'API tokens & webhooks guide', href: '/guides/api-and-webhooks' },
      { label: 'API docs', href: links.apiDocsUrl, external: true },
    ],
  };
}

function resourceCards(links: MarketingLinks): NavCard[] {
  return [
    {
      title: 'Guides',
      body: 'Step-by-step help for every part of your admin.',
      href: '/guides',
      icon: 'file',
    },
    {
      title: 'Security',
      body: 'How stores, payments and accounts are protected.',
      href: '/security',
      icon: 'shield',
    },
    { title: 'Contact', body: 'Email our support team.', href: '/contact', icon: 'mail' },
    {
      title: 'API docs',
      body: 'The OpenAPI reference for the REST API.',
      href: links.apiDocsUrl,
      icon: 'code',
      external: true,
    },
  ];
}

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-600';
const panelLink = `rounded-md text-sm text-slate-600 hover:text-azure-700 ${focusRing}`;
const summaryClass =
  'flex cursor-pointer list-none items-center justify-between py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path
        fillRule="evenodd"
        d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ExternalMark() {
  return <span aria-label="(opens in a new tab)"> ↗</span>;
}

function LinkItem({
  link,
  className,
  onClick,
}: {
  link: NavLink;
  className: string;
  onClick: () => void;
}) {
  return (
    <a
      href={link.href}
      onClick={onClick}
      className={className}
      {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {link.label}
      {link.external ? <ExternalMark /> : null}
    </a>
  );
}

/**
 * Marketing header: mega-menus on wide screens (hover, click or keyboard; Escape and clicks
 * outside close them) and a full-screen drawer with accordion groups on phones.
 */
export function SiteNav({ links }: { links: MarketingLinks }) {
  const [open, setOpen] = useState<MenuId | null>(null);
  const [drawer, setDrawer] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttons = useRef<Record<MenuId, HTMLButtonElement | null>>({
    why: null,
    products: null,
    resources: null,
  });
  const drawerButton = useRef<HTMLButtonElement>(null);
  const extend = extendGroup(links);
  const resources = resourceCards(links);

  useEffect(() => {
    if (!open && !drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (open) buttons.current[open]?.focus();
      if (drawer) drawerButton.current?.focus();
      setOpen(null);
      setDrawer(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, drawer]);

  // The drawer covers the page: stop the page behind it from scrolling.
  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawer]);

  const close = () => setOpen(null);

  const trigger = (id: MenuId, label: string) => (
    <button
      ref={(el) => {
        buttons.current[id] = el;
      }}
      type="button"
      aria-expanded={open === id}
      aria-controls={`menu-${id}`}
      onClick={() => setOpen(open === id ? null : id)}
      onMouseEnter={() => setOpen(id)}
      className={`flex items-center gap-1 rounded-md px-3 py-2 text-[0.9375rem] font-medium transition hover:text-azure-700 ${
        open === id ? 'text-azure-700' : 'text-navy-900'
      } ${focusRing}`}
    >
      {label}
      <Chevron open={open === id} />
    </button>
  );

  const directLink = (href: string, label: string) => (
    <li key={href}>
      <a
        href={href}
        onMouseEnter={close}
        className={`rounded-md px-3 py-2 text-[0.9375rem] font-medium text-navy-900 transition hover:text-azure-700 ${focusRing}`}
      >
        {label}
      </a>
    </li>
  );

  const cardPanel = (id: MenuId, cards: NavCard[]) => (
    <div
      id={`menu-${id}`}
      hidden={open !== id}
      className="absolute inset-x-0 top-full border-b border-slate-900/10 bg-white text-slate-900 shadow-[0_30px_60px_-30px_rgb(15_23_42/0.35)]"
    >
      <ul
        className={`mx-auto grid max-w-7xl gap-5 px-8 py-8 ${cards.length > 3 ? 'grid-cols-4' : 'grid-cols-3'}`}
      >
        {cards.map((card) => (
          <li key={card.title}>
            <a
              href={card.href}
              onClick={close}
              {...(card.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className={`group flex h-full flex-col overflow-hidden rounded-xl bg-mist ring-1 ring-slate-900/[0.06] transition hover:bg-white hover:shadow-lg hover:ring-slate-900/10 ${focusRing}`}
            >
              {card.photo ? (
                <span className="block aspect-[16/8] overflow-hidden">
                  <Photo
                    name={card.photo}
                    alt=""
                    className="transition duration-500 group-hover:scale-105"
                  />
                </span>
              ) : null}
              <span className="flex flex-1 flex-col p-6">
                {card.photo ? null : (
                  <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-white text-azure-600 shadow-sm ring-1 ring-slate-900/10">
                    <Icon name={card.icon} />
                  </span>
                )}
                <span className="font-semibold text-navy-900">
                  {card.title}
                  {card.external ? <ExternalMark /> : null}
                </span>
                <span className="mt-1.5 text-sm leading-6 text-slate-600">{card.body}</span>
                <span className="mt-auto pt-4 text-sm font-semibold text-azure-700">
                  {card.external ? 'Open' : 'Learn more'} <span aria-hidden="true">→</span>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  const drawerGroup = (title: string, items: NavLink[]) => (
    <details key={title} className="group border-b border-slate-200">
      <summary className={summaryClass}>
        {title}
        <span className="text-slate-400 group-open:rotate-180">
          <Chevron open={false} />
        </span>
      </summary>
      <ul className="space-y-3 pb-5 pl-1">
        {items.map((item) => (
          <li key={item.label}>
            <LinkItem
              link={item}
              className="text-slate-600 hover:text-azure-600"
              onClick={() => setDrawer(false)}
            />
          </li>
        ))}
      </ul>
    </details>
  );

  return (
    <>
      <header
        ref={headerRef}
        onMouseLeave={close}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
        }}
        className="sticky top-0 z-50 border-b border-slate-900/[0.06] bg-white/75 text-slate-900 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset] backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <a href="/" className={`rounded-md ${focusRing}`} aria-label="Commerce Platform home">
            <Logo tone="light" />
          </a>
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              <li>{trigger('why', 'Why us')}</li>
              <li>{trigger('products', 'Products')}</li>
              {directLink('/templates', 'Templates')}
              {directLink('/pricing', 'Pricing')}
              <li>{trigger('resources', 'Resources')}</li>
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a
              href={links.loginUrl}
              className={`hidden rounded-md px-3.5 py-2 text-sm font-semibold text-azure-700 ring-1 ring-azure-600/60 transition hover:bg-azure-50 sm:block ${focusRing}`}
            >
              Log in
            </a>
            <a
              href={links.signupUrl}
              className={`group inline-flex items-center gap-1.5 rounded-md bg-azure-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-[0_1px_2px_rgb(10_34_54/0.2)] transition hover:bg-azure-700 ${focusRing}`}
            >
              Start for free
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </a>
            <button
              ref={drawerButton}
              type="button"
              aria-expanded={drawer}
              aria-controls="mobile-menu"
              onClick={() => setDrawer(true)}
              className={`-mr-1 rounded-md p-2 text-slate-700 hover:text-navy-900 lg:hidden ${focusRing}`}
            >
              <span className="sr-only">Open menu</span>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-6">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mega-menus */}
        {cardPanel('why', WHY_US)}
        {cardPanel('resources', resources)}
        <div
          id="menu-products"
          hidden={open !== 'products'}
          className="absolute inset-x-0 top-full border-b border-slate-900/10 bg-white text-slate-900 shadow-[0_30px_60px_-30px_rgb(15_23_42/0.35)]"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-[1fr_17rem] gap-10 px-8 py-9">
            <div className="grid grid-cols-3 gap-x-8 gap-y-8">
              {PRODUCT_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="flex items-center gap-2.5 text-sm font-semibold text-navy-900">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-azure-50 text-azure-600">
                      <Icon name={group.icon} className="size-4" />
                    </span>
                    {group.title}
                  </p>
                  <ul className="mt-3 space-y-2.5 pl-9.5">
                    {group.items.map((item) => (
                      <li key={item.label}>
                        <LinkItem link={item} className={panelLink} onClick={close} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-xl bg-mist ring-1 ring-slate-900/[0.06]">
                <span className="block aspect-[16/8] overflow-hidden">
                  <Photo name="laptop-shop-counter" alt="" />
                </span>
                <div className="p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="text-azure-600">
                      <Icon name={extend.icon} className="size-4" />
                    </span>
                    {extend.title}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {extend.items.map((item) => (
                      <li key={item.label}>
                        <LinkItem link={item} className={panelLink} onClick={close} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <a
                href="/features"
                onClick={close}
                className={`rounded-md px-1 text-sm font-semibold text-azure-700 hover:text-azure-600 ${focusRing}`}
              >
                See all features <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Phone drawer (outside the header: its backdrop blur would trap a fixed child) */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!drawer}
        className="fixed inset-0 z-50 overflow-y-auto bg-white text-slate-900 lg:hidden"
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 sm:px-6">
          <Logo tone="light" />
          <button
            type="button"
            onClick={() => {
              setDrawer(false);
              drawerButton.current?.focus();
            }}
            className="-mr-1 rounded-md p-2 text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-azure-600"
          >
            <span className="sr-only">Close menu</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-6">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <nav aria-label="Mobile" className="px-4 pb-10 sm:px-6">
          {drawerGroup(
            'Why us',
            WHY_US.map((c) => ({ label: c.title, href: c.href })),
          )}
          {[...PRODUCT_GROUPS, extend].map((group) => drawerGroup(group.title, group.items))}
          {drawerGroup(
            'Resources',
            resources.map((c) => ({ label: c.title, href: c.href, external: c.external })),
          )}
          {[
            { href: '/features', label: 'All features' },
            { href: '/templates', label: 'Templates' },
            { href: '/pricing', label: 'Pricing' },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setDrawer(false)}
              className="block border-b border-slate-200 py-4 text-lg font-semibold"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-8 grid gap-3">
            <a
              href={links.signupUrl}
              className="rounded-md bg-azure-600 px-5 py-3 text-center font-semibold text-white"
            >
              Start for free
            </a>
            <a
              href={links.loginUrl}
              className="rounded-md px-5 py-3 text-center font-semibold text-azure-700 ring-1 ring-azure-600/60"
            >
              Log in
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
