import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { MenuLink } from '@/components/content';
import { CurrencySwitcher } from '@/components/currency-switcher';
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
  return (
    <html lang="en">
      <body
        className="flex min-h-screen flex-col bg-white text-zinc-900 antialiased"
        style={themeStyle(shop.theme)}
      >
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2">
          Skip to content
        </a>
        {shop.theme.settings.announcement ? (
          <p className="bg-accent px-4 py-2 text-center text-sm text-[var(--store-accent-contrast)]">
            {shop.theme.settings.announcement}
          </p>
        ) : null}
        <header className="border-b border-zinc-200">
          {/* Phones: logo + account/cart, then full-width search, then a scrolling menu row. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4">
            <Link href="/" className="order-1 text-xl font-bold tracking-tight text-brand">
              {shop.name}
            </Link>
            <nav
              aria-label="Main"
              className="order-4 -mx-4 flex w-full gap-4 overflow-x-auto whitespace-nowrap px-4 text-sm md:order-2 md:mx-0 md:w-auto md:flex-1 md:flex-wrap md:overflow-visible md:px-0"
            >
              {shop.menus.main.map((link) => (
                <MenuLink
                  key={`${link.title}-${link.href}`}
                  link={link}
                  className="text-zinc-700 hover:text-zinc-950"
                />
              ))}
            </nav>
            <form action="/search" role="search" className="order-3 flex w-full md:w-auto">
              <label htmlFor="site-search" className="sr-only">
                Search products
              </label>
              <input
                id="site-search"
                name="q"
                type="search"
                placeholder="Search"
                className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm md:w-56"
              />
            </form>
            <div className="order-2 ml-auto flex items-center gap-4 md:order-4 md:ml-0">
              {shop.currencies.length > 1 ? (
                <CurrencySwitcher
                  current={shop.currency}
                  currencies={shop.currencies}
                  returnPath={path}
                />
              ) : null}
              <Link href="/account" className="text-sm text-zinc-700 hover:underline">
                Account
              </Link>
              <Link href="/cart" className="text-sm font-medium text-zinc-900 hover:underline">
                Cart ({cart?.itemCount ?? 0})
              </Link>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-zinc-200 py-8 text-sm text-zinc-500">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4">
            {shop.menus.footer.length > 0 || shop.policies.length > 0 ? (
              <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
                {shop.menus.footer.map((link) => (
                  <MenuLink
                    key={`${link.title}-${link.href}`}
                    link={link}
                    className="hover:text-zinc-900 hover:underline"
                  />
                ))}
                {shop.policies.map((p) => (
                  <Link
                    key={p.kind}
                    href={`/policies/${p.kind}`}
                    className="hover:text-zinc-900 hover:underline"
                  >
                    {p.title}
                  </Link>
                ))}
              </nav>
            ) : null}
            <p>
              © {new Date().getFullYear()} {shop.name} ·{' '}
              <a href={`mailto:${shop.contactEmail}`} className="hover:underline">
                {shop.contactEmail}
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
