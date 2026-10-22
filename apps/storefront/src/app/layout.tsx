import { THEME_PREVIEW_PARAM } from '@repo/contracts';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { StoreFooter } from '@/components/footer/store-footer';
import { StoreHeader } from '@/components/header/store-header';
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
        id="top"
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
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-page focus:p-2"
        >
          Skip to content
        </a>
        {shop.theme.settings.announcement ? (
          <p className="bg-accent px-4 py-2.5 text-center text-[0.8125rem] font-medium tracking-wide text-accent-contrast">
            {shop.theme.settings.announcement}
          </p>
        ) : null}
        <StoreHeader shop={shop} path={path} itemCount={cart?.itemCount ?? 0} />
        <main id="main" className="store-main mx-auto w-full max-w-6xl flex-1 px-4">
          {children}
        </main>
        <StoreFooter shop={shop} />
        {shop.theme.settings.cartStyle === 'drawer' ? <CartDrawer cart={cart} /> : null}
      </body>
    </html>
  );
}
