import { type Shop, THEME_PREVIEW_PARAM, type ThemeSettings } from '@repo/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { MenuLink } from '@/components/content';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { PlatformSite } from '@/components/platform-landing';
import { requestHost } from '@/lib/api';
import { getCart, getShop, getThemePreview, isRootHost } from '@/lib/shop';
import { themeAttributes, themeStyle } from '@/lib/theme';
import { PasswordForm } from './password/password-form';
import './globals.css';

// Per-request rendering is required for the CSP nonce (see src/proxy.ts) to reach Next's scripts.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop();
  if (!shop && isRootHost(await requestHost())) {
    return {
      title: {
        default: 'Commerce Platform — Start your online store',
        template: '%s · Commerce Platform',
      },
      description:
        'Create an online store with templates for 12 industries, built-in checkout, multi-currency selling and everything you need to run it.',
    };
  }
  return shop
    ? {
        title: { default: shop.name, template: `%s · ${shop.name}` },
        description: `Shop ${shop.name}`,
      }
    : { title: 'Commerce Platform' };
}

/** Paths that belong to one shopper and keep working while the store is locked. */
const LOCK_EXEMPT = ['/orders/', '/invoices/', '/checkout/pay/'];

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
    const path = (await headers()).get('x-pathname') ?? '/';
    return (
      <html lang="en">
        <body className="min-h-screen bg-white text-zinc-900 antialiased">
          {isRootHost(host) ? (
            <PlatformSite path={path}>{children}</PlatformSite>
          ) : (
            <StoreNotFound />
          )}
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
          className="flex min-h-screen items-center justify-center antialiased"
          style={themeStyle(shop.theme)}
          {...themeAttributes(shop.theme)}
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

  const [cart, preview] = await Promise.all([shop.locked ? null : getCart(), getThemePreview()]);
  return (
    <html lang="en">
      <body
        className="flex min-h-screen flex-col antialiased"
        style={themeStyle(shop.theme)}
        {...themeAttributes(shop.theme)}
      >
        {preview ? (
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#18181b] px-4 py-2 text-center text-xs text-[#fafafa]">
            <span>
              Previewing “{preview.name}” · {preview.industryLabel} · {preview.styleLabel}
            </span>
            <a href={`${path}?${THEME_PREVIEW_PARAM}=off`} className="font-semibold underline">
              Exit preview
            </a>
          </p>
        ) : null}
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2">
          Skip to content
        </a>
        {shop.theme.settings.announcement ? (
          <p className="bg-accent px-4 py-2 text-center text-sm text-accent-contrast">
            {shop.theme.settings.announcement}
          </p>
        ) : null}
        <StoreHeader shop={shop} path={path} itemCount={cart?.itemCount ?? 0} />
        <main id="main" className="store-main mx-auto w-full max-w-6xl flex-1 px-4">
          {children}
        </main>
        <StoreFooter shop={shop} />
      </body>
    </html>
  );
}

/**
 * Phones get the same header in every style: logo + account/cart, then a full-width search,
 * then a horizontally scrolling menu. The style decides the wider-screen arrangement.
 */
const HEADER_CLASSES: Record<
  ThemeSettings['headerStyle'],
  { row: string; logo: string; nav: string; search: string; actions: string }
> = {
  inline: {
    row: 'py-4',
    logo: 'text-xl',
    nav: 'md:order-2 md:w-auto md:flex-1',
    search: 'md:w-auto',
    actions: 'md:order-4 md:ml-0',
  },
  centered: {
    row: 'py-4 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-y-5 md:py-6',
    logo: 'text-xl md:col-start-2 md:row-start-1 md:text-center md:text-3xl',
    nav: 'md:col-span-3 md:row-start-2 md:w-full md:justify-center md:gap-x-8 md:text-xs md:uppercase md:tracking-[0.16em]',
    search: 'md:col-start-1 md:row-start-1 md:w-auto md:justify-self-start',
    actions: 'md:col-start-3 md:row-start-1 md:ml-0 md:justify-self-end',
  },
  stacked: {
    row: 'py-4 md:gap-y-0 md:py-0',
    logo: 'text-xl md:py-5 md:text-2xl',
    nav: 'md:order-4 md:w-full md:gap-x-7 md:border-t md:border-zinc-200 md:py-3',
    search: 'md:order-2 md:ml-auto md:w-auto',
    actions: 'md:order-3 md:ml-0',
  },
};

function StoreHeader({ shop, path, itemCount }: { shop: Shop; path: string; itemCount: number }) {
  const c = HEADER_CLASSES[shop.theme.settings.headerStyle];
  return (
    <header className="border-b border-zinc-200">
      <div
        className={`mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 ${c.row}`}
      >
        <Link
          href="/"
          className={`order-1 min-w-0 font-heading font-bold tracking-tight text-brand ${c.logo}`}
        >
          {shop.name}
        </Link>
        <nav
          aria-label="Main"
          className={`order-4 -mx-4 flex w-full gap-4 overflow-x-auto whitespace-nowrap px-4 text-sm md:mx-0 md:flex-wrap md:overflow-visible md:px-0 ${c.nav}`}
        >
          {shop.menus.main.map((link) => (
            <MenuLink
              key={`${link.title}-${link.href}`}
              link={link}
              className="text-zinc-700 hover:text-zinc-950"
            />
          ))}
        </nav>
        <form action="/search" role="search" className={`order-3 flex w-full ${c.search}`}>
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search"
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm placeholder:text-zinc-500 md:w-56"
          />
        </form>
        <div className={`order-2 ml-auto flex items-center gap-4 ${c.actions}`}>
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
            Cart ({itemCount})
          </Link>
        </div>
      </div>
    </header>
  );
}

function StoreFooter({ shop }: { shop: Shop }) {
  const style = shop.theme.settings.footerStyle;
  const year = new Date().getFullYear();
  const email = (
    <a href={`mailto:${shop.contactEmail}`} className="hover:underline">
      {shop.contactEmail}
    </a>
  );
  const linkClass = 'hover:text-zinc-900 hover:underline';
  const menuLinks = shop.menus.footer.map((link) => (
    <MenuLink key={`${link.title}-${link.href}`} link={link} className={linkClass} />
  ));
  const policyLinks = shop.policies.map((p) => (
    <Link key={p.kind} href={`/policies/${p.kind}`} className={linkClass}>
      {p.title}
    </Link>
  ));
  const hasLinks = menuLinks.length > 0 || policyLinks.length > 0;

  if (style === 'simple') {
    return (
      <footer className="border-t border-zinc-200 py-8 text-sm text-zinc-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4">
          {hasLinks ? (
            <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {menuLinks}
              {policyLinks}
            </nav>
          ) : null}
          <p className="text-center">
            © {year} {shop.name} · {email}
          </p>
        </div>
      </footer>
    );
  }

  // "columns" and "dark" share a layout; "dark" sits on a band in the theme's inverse colors.
  const columnHeading = 'mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-900';
  return (
    <footer
      className={`py-12 text-sm text-zinc-600 ${
        style === 'dark' ? 'theme-band' : 'border-t border-zinc-200 bg-surface'
      }`}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[2fr_3fr]">
        <div>
          <p className="font-heading text-lg font-bold text-zinc-900">{shop.name}</p>
          <p className="mt-2 break-words">{email}</p>
          <p className="mt-6 text-xs text-zinc-500">
            © {year} {shop.name}
          </p>
        </div>
        {hasLinks ? (
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8">
            {menuLinks.length > 0 ? (
              <div>
                <p className={columnHeading}>Explore</p>
                <div className="flex flex-col items-start gap-2">{menuLinks}</div>
              </div>
            ) : null}
            {policyLinks.length > 0 ? (
              <div>
                <p className={columnHeading}>Policies</p>
                <div className="flex flex-col items-start gap-2">{policyLinks}</div>
              </div>
            ) : null}
          </nav>
        ) : null}
      </div>
    </footer>
  );
}
