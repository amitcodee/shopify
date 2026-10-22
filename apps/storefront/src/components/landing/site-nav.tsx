'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';
import { Logo } from './logo';
import type { MarketingLinks } from './urls';

type MenuId = 'why' | 'products';

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

const WHY_US: { title: string; body: string; href: string; icon: IconName }[] = [
  {
    title: 'Get started fast',
    body: 'Pick a template for your industry, add products and open your store the same day.',
    href: '/#get-started',
    icon: 'rocket',
  },
  {
    title: 'Switch from another platform',
    body: 'Bring your catalog over with a Shopify-style product CSV, one row per variant.',
    href: '/#developers',
    icon: 'switch',
  },
  {
    title: 'Built-in checkout & 2FA security',
    body: 'Hosted card payments through Stripe or Razorpay, and two-factor sign-in for staff.',
    href: '/#payments',
    icon: 'shield',
  },
];

const PRODUCT_GROUPS: NavGroup[] = [
  {
    title: 'Build your website',
    icon: 'layout',
    items: [
      { label: 'Templates', href: '/templates' },
      { label: 'Online store pages & blog', href: '/#online-store' },
      { label: 'Custom domains', href: '/#online-store' },
    ],
  },
  {
    title: 'Sell anywhere',
    icon: 'globe',
    items: [
      { label: 'Multi-currency', href: '/#sell-globally' },
      { label: 'Draft orders & invoices', href: '/#back-office' },
      { label: 'Gift cards', href: '/#checkout' },
    ],
  },
  {
    title: 'Marketing & analytics',
    icon: 'chart',
    items: [
      { label: 'Discounts', href: '/#marketing' },
      { label: 'Abandoned checkout emails', href: '/#marketing' },
      { label: 'Customer segments', href: '/#marketing' },
      { label: 'Analytics', href: '/#marketing' },
    ],
  },
  {
    title: 'Run your business',
    icon: 'truck',
    items: [
      { label: 'Inventory & locations', href: '/#back-office' },
      { label: 'Orders, returns & packing slips', href: '/#back-office' },
      { label: 'Staff & permissions', href: '/#payments' },
    ],
  },
  {
    title: 'Get paid',
    icon: 'card',
    items: [
      { label: 'Stripe', href: '/#payments' },
      { label: 'Razorpay', href: '/#payments' },
      { label: 'Payouts to your account', href: '/#payments' },
    ],
  },
];

function extendGroup(links: MarketingLinks): NavGroup {
  return {
    title: 'Customize & extend',
    icon: 'code',
    items: [
      { label: 'Admin API tokens', href: '/#developers' },
      { label: 'Signed webhooks', href: '/#developers' },
      { label: 'API docs', href: links.apiDocsUrl, external: true },
    ],
  };
}

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400';
const panelLink = `rounded-md text-sm text-slate-600 hover:text-indigo-600 ${focusRing.replace('400', '600')}`;

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
  const buttons = useRef<Record<MenuId, HTMLButtonElement | null>>({ why: null, products: null });
  const drawerButton = useRef<HTMLButtonElement>(null);
  const extend = extendGroup(links);

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
      className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition hover:text-white ${
        open === id ? 'text-white' : 'text-slate-300'
      } ${focusRing}`}
    >
      {label}
      <Chevron open={open === id} />
    </button>
  );

  return (
    <>
      <header
        ref={headerRef}
        onMouseLeave={() => setOpen(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(null);
        }}
        className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the root layout picks the page from the request path, so marketing links must do full loads */}
          <a href="/" className={`rounded-md ${focusRing}`} aria-label="Commerce Platform home">
            <Logo tone="dark" />
          </a>
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              <li>{trigger('why', 'Why us')}</li>
              <li>{trigger('products', 'Products')}</li>
              {[
                { href: '/templates', label: 'Templates' },
                { href: '/pricing', label: 'Pricing' },
              ].map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onMouseEnter={() => setOpen(null)}
                    className={`rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:text-white ${focusRing}`}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a
              href={links.loginUrl}
              className={`hidden rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:text-white sm:block ${focusRing}`}
            >
              Log in
            </a>
            <a
              href={links.signupUrl}
              className={`whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-slate-950 hover:bg-indigo-100 ${focusRing}`}
            >
              Start for free
            </a>
            <button
              ref={drawerButton}
              type="button"
              aria-expanded={drawer}
              aria-controls="mobile-menu"
              onClick={() => setDrawer(true)}
              className={`-mr-1 rounded-md p-2 text-slate-200 hover:text-white lg:hidden ${focusRing}`}
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
        <div
          id="menu-why"
          hidden={open !== 'why'}
          className="absolute inset-x-0 top-full border-b border-slate-200 bg-white text-slate-900 shadow-2xl"
        >
          <ul className="mx-auto grid max-w-7xl grid-cols-3 gap-6 px-6 py-8">
            {WHY_US.map((card) => (
              <li key={card.title}>
                <a
                  href={card.href}
                  onClick={() => setOpen(null)}
                  className="group flex h-full flex-col rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50 p-6 ring-1 ring-slate-200 transition hover:ring-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                    <Icon name={card.icon} />
                  </span>
                  <span className="mt-4 font-semibold text-slate-900">{card.title}</span>
                  <span className="mt-1.5 text-sm leading-6 text-slate-600">{card.body}</span>
                  <span className="mt-4 text-sm font-semibold text-indigo-600 group-hover:text-indigo-500">
                    Learn more →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div
          id="menu-products"
          hidden={open !== 'products'}
          className="absolute inset-x-0 top-full border-b border-slate-200 bg-white text-slate-900 shadow-2xl"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-[1fr_15rem] gap-8 px-6 py-8">
            <div className="grid grid-cols-3 gap-x-8 gap-y-8">
              {PRODUCT_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="text-indigo-600">
                      <Icon name={group.icon} className="size-4" />
                    </span>
                    {group.title}
                  </p>
                  <ul className="mt-3 space-y-2 border-l border-slate-200 pl-6">
                    {group.items.map((item) => (
                      <li key={item.label}>
                        <LinkItem link={item} className={panelLink} onClick={() => setOpen(null)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="text-indigo-600">
                  <Icon name={extend.icon} className="size-4" />
                </span>
                {extend.title}
              </p>
              <ul className="mt-3 space-y-2">
                {extend.items.map((item) => (
                  <li key={item.label}>
                    <LinkItem link={item} className={panelLink} onClick={() => setOpen(null)} />
                  </li>
                ))}
              </ul>
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
            className="-mr-1 rounded-md p-2 text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600"
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
          <details className="group border-b border-slate-200">
            <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              Why us
              <span className="text-slate-400 group-open:rotate-180">
                <Chevron open={false} />
              </span>
            </summary>
            <ul className="space-y-3 pb-5">
              {WHY_US.map((card) => (
                <li key={card.title}>
                  <a
                    href={card.href}
                    onClick={() => setDrawer(false)}
                    className="block rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
                  >
                    <span className="font-semibold">{card.title}</span>
                    <span className="mt-1 block text-sm text-slate-600">{card.body}</span>
                  </a>
                </li>
              ))}
            </ul>
          </details>
          {[...PRODUCT_GROUPS, extend].map((group) => (
            <details key={group.title} className="group border-b border-slate-200">
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {group.title}
                <span className="text-slate-400 group-open:rotate-180">
                  <Chevron open={false} />
                </span>
              </summary>
              <ul className="space-y-3 pb-5 pl-1">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <LinkItem
                      link={item}
                      className="text-slate-600 hover:text-indigo-600"
                      onClick={() => setDrawer(false)}
                    />
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {[
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
              className="rounded-full bg-slate-950 px-5 py-3 text-center font-semibold text-white"
            >
              Start for free
            </a>
            <a
              href={links.loginUrl}
              className="rounded-full px-5 py-3 text-center font-semibold text-slate-900 ring-1 ring-slate-300"
            >
              Log in
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
