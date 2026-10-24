import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { MenuLink } from '@/components/content';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { Icon } from '@/components/icons';
import { requestHost } from '@/lib/api';
import { getCart, getShop, isRootHost } from '@/lib/shop';
import { themeStyle } from '@/lib/theme';
import { PasswordForm } from './password/password-form';
import './globals.css';

// Per-request rendering is required for the CSP nonce (see src/proxy.ts) to reach Next's scripts.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  return shop
    ? {
        title: { default: shop.name, template: `%s · ${shop.name}` },
        description: `Shop ${shop.name}`,
      }
    : { title: 'Commerce Platform' };
}

/** Paths that belong to one shopper and keep working while the store is locked. */
const LOCK_EXEMPT = ['/orders/', '/invoices/', '/checkout/pay/'];

const adminUrl = process.env.ADMIN_PUBLIC_URL ?? 'http://localhost:3100';

function PlatformLanding() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
        Commerce Platform
      </p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
        Start your online store
      </h1>
      <p className="mt-4 text-lg text-zinc-600">
        Create a store, add products, and start selling in minutes. Each store gets its own address.
      </p>
      <a
        href={`${adminUrl}/signup`}
        className="mt-8 inline-block rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700"
      >
        Create your store
      </a>
    </main>
  );
}

function StoreNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">Store not found</h1>
      <p className="mt-2 text-zinc-600">This store does not exist or is currently unavailable.</p>
    </main>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const host = await requestHost();
  const shop = await getShop();

  if (!shop) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-white text-zinc-900 antialiased">
          {isRootHost(host) ? <PlatformLanding /> : <StoreNotFound />}
        </body>
      </html>
    );
  }

  // Password-protected store: only per-shopper links (order status, invoices, payment) open.
  const path = (await headers()).get('x-pathname') ?? '/';
  if (shop.locked && !LOCK_EXEMPT.some((prefix) => path.startsWith(prefix))) {
    return (
      <html lang="en">
        <body
          className="flex min-h-screen items-center justify-center bg-white text-zinc-900 antialiased"
          style={themeStyle(shop.theme)}
        >
          <main className="w-full max-w-sm px-6 py-24 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-brand">{shop.name}</h1>
            <p className="mt-3 text-zinc-600">{shop.passwordMessage || 'Opening soon.'}</p>
            <div className="mt-8">
              <PasswordForm />
            </div>
          </main>
        </body>
      </html>
    );
  }

  const cart = shop.locked ? null : await getCart();
  const itemCount = cart?.itemCount ?? 0;
  return (
    <html lang="en">
      <body
        className="flex min-h-screen flex-col bg-white text-zinc-900 antialiased"
        style={themeStyle(shop.theme)}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-white focus:p-2 focus:shadow"
        >
          Skip to content
        </a>
        {shop.theme.settings.announcement ? (
          <p className="bg-accent px-4 py-2 text-center text-[13px] font-medium tracking-wide text-accent-contrast">
            {shop.theme.settings.announcement}
          </p>
        ) : null}
        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="shrink-0 text-lg font-bold tracking-tight text-brand sm:text-xl"
            >
              {shop.name}
            </Link>
            <nav
              aria-label="Main"
              className="hidden flex-1 items-center gap-1 text-sm font-medium md:flex"
            >
              {shop.menus.main.map((link) => (
                <MenuLink
                  key={`${link.title}-${link.href}`}
                  link={link}
                  className="rounded-full px-3 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                />
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <form action="/search" role="search" className="relative hidden sm:block">
                <label htmlFor="site-search" className="sr-only">
                  Search products
                </label>
                <Icon
                  name="search"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400"
                />
                <input
                  id="site-search"
                  name="q"
                  type="search"
                  placeholder="Search"
                  className="w-44 rounded-full border-0 bg-zinc-100 py-2 pr-3 pl-9 text-sm transition-all placeholder:text-zinc-500 focus:w-60 focus:bg-white focus:ring-2 focus:ring-accent/40 focus:outline-none lg:w-52"
                />
              </form>
              <Link
                href="/search"
                className="grid size-10 place-items-center rounded-full text-zinc-700 hover:bg-zinc-100 sm:hidden"
              >
                <Icon name="search" className="size-5" />
                <span className="sr-only">Search</span>
              </Link>
              {shop.currencies.length > 1 ? (
                <CurrencySwitcher
                  current={shop.currency}
                  currencies={shop.currencies}
                  returnPath={path}
                />
              ) : null}
              <Link
                href="/account"
                className="inline-flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              >
                <Icon name="user" className="size-5" />
                <span className="max-lg:sr-only">Account</span>
              </Link>
              <Link
                href="/cart"
                aria-label={`Cart (${itemCount})`}
                className="relative inline-flex h-10 items-center gap-2 rounded-full bg-brand px-3.5 text-sm font-semibold text-brand-contrast shadow-sm transition hover:opacity-90"
              >
                <Icon name="bag" className="size-[18px]" />
                <span className="max-sm:hidden">Cart</span>
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-contrast/20 px-1 text-xs tabular-nums">
                  {itemCount}
                </span>
              </Link>
            </div>
          </div>
          {shop.menus.main.length > 0 ? (
            <nav
              aria-label="Sections"
              className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-3 py-2 text-sm font-medium [scrollbar-width:none] md:hidden"
            >
              {shop.menus.main.map((link) => (
                <MenuLink
                  key={`${link.title}-${link.href}`}
                  link={link}
                  className="shrink-0 rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                />
              ))}
            </nav>
          ) : null}
        </header>
        <main
          id="main"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
        >
          {children}
        </main>
        <footer className="mt-16 border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
            <div>
              <p className="text-lg font-bold tracking-tight text-brand">{shop.name}</p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
                {shop.theme.settings.heroSubtitle || 'Thanks for shopping with us.'}
              </p>
              <a
                href={`mailto:${shop.contactEmail}`}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-950"
              >
                <Icon name="mail" className="size-4 text-zinc-400" />
                {shop.contactEmail}
              </a>
            </div>
            {shop.menus.footer.length > 0 || shop.policies.length > 0 ? (
              <nav aria-label="Footer" className="grid grid-cols-2 gap-10 md:col-span-2">
                {shop.menus.footer.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                      Explore
                    </p>
                    <ul className="mt-4 space-y-2.5 text-sm">
                      {shop.menus.footer.map((link) => (
                        <li key={`${link.title}-${link.href}`}>
                          <MenuLink link={link} className="text-zinc-600 hover:text-zinc-950" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {shop.policies.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold tracking-[0.12em] text-zinc-400 uppercase">
                      Policies
                    </p>
                    <ul className="mt-4 space-y-2.5 text-sm">
                      {shop.policies.map((p) => (
                        <li key={p.kind}>
                          <Link
                            href={`/policies/${p.kind}`}
                            className="text-zinc-600 hover:text-zinc-950"
                          >
                            {p.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </nav>
            ) : null}
          </div>
          <div className="border-t border-zinc-200">
            <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-zinc-500 sm:px-6 lg:px-8">
              © {new Date().getFullYear()} {shop.name}. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
