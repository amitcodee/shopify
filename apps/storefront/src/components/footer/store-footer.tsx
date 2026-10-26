import type { Shop } from '@repo/contracts';
import Link from 'next/link';
import { MenuLink } from '@/components/content';
import { ArrowUpIcon } from '@/components/header/icons';
import { SocialLinks } from './social-links';

/** Store footer in the theme's footer style: "simple" (one centered block), "columns" or "dark". */
export function StoreFooter({ shop }: { shop: Shop }) {
  const s = shop.theme.settings;
  const style = s.footerStyle;
  const year = new Date().getFullYear();
  const email = (
    <a
      href={`mailto:${shop.contactEmail}`}
      className="underline-offset-4 hover:text-zinc-900 hover:underline"
    >
      {shop.contactEmail}
    </a>
  );
  const linkClass = 'underline-offset-4 hover:text-zinc-900 hover:underline';
  const menuLinks = shop.menus.footer.map((link) => (
    <MenuLink key={`${link.title}-${link.href}`} link={link} className={linkClass} />
  ));
  const policyLinks = shop.policies.map((p) => (
    <Link key={p.kind} href={`/policies/${p.kind}`} className={linkClass}>
      {p.title}
    </Link>
  ));
  const hasLinks = menuLinks.length > 0 || policyLinks.length > 0;
  const currencyNote =
    shop.currencies.length > 1 ? (
      <span>
        Prices shown in {shop.currency} · also available in{' '}
        {shop.currencies.filter((c) => c !== shop.currency).join(', ')}
      </span>
    ) : null;
  const backToTop = (
    <a
      href="#top"
      className="inline-flex items-center gap-1.5 font-medium text-zinc-700 hover:text-zinc-900"
    >
      Back to top
      <ArrowUpIcon />
    </a>
  );

  if (style === 'simple') {
    return (
      <footer
        data-section="footer"
        className="store-footer mt-8 border-t border-zinc-200 py-12 text-sm text-zinc-500"
      >
        <div className="store-container flex flex-col items-center gap-5 text-center">
          <SocialLinks settings={s} className="justify-center" />
          {hasLinks ? (
            <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {menuLinks}
              {policyLinks}
            </nav>
          ) : null}
          <p className="t-title text-xl text-zinc-900">{shop.name}</p>
          <p>
            © {year} {shop.name} · {email}
          </p>
          {currencyNote ? <p className="text-xs">{currencyNote}</p> : null}
          {backToTop}
        </div>
      </footer>
    );
  }

  // "columns" and "dark" share a layout; "dark" sits on a band in the theme's inverse colors.
  const dark = style === 'dark';
  const columnHeading = 'eyebrow mb-5 text-zinc-900';
  const column = 'flex flex-col items-start gap-3';
  const shopLinks = shop.collections.slice(0, 5);
  return (
    <footer
      data-section="footer"
      className={`store-footer mt-8 pt-16 pb-8 text-sm text-zinc-600 sm:pt-20 ${
        dark ? 'theme-band' : 'border-t border-zinc-200 bg-surface'
      }`}
    >
      <div className="store-container">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className={`t-title text-zinc-900 ${dark ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>
              {shop.name}
            </p>
            <p className="mt-4 max-w-xs leading-relaxed">
              Questions about an order? Write to us at
            </p>
            <p className="mt-1 font-medium break-words text-zinc-900">{email}</p>
            <SocialLinks settings={s} className="mt-7" />
          </div>
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4 lg:col-span-8"
          >
            {shopLinks.length > 0 ? (
              <div>
                <p className={columnHeading}>Shop</p>
                <div className={column}>
                  <Link href="/collections/all" className={linkClass}>
                    All products
                  </Link>
                  {shopLinks.map((c) => (
                    <Link key={c.handle} href={`/collections/${c.handle}`} className={linkClass}>
                      {c.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {menuLinks.length > 0 ? (
              <div>
                <p className={columnHeading}>Explore</p>
                <div className={column}>{menuLinks}</div>
              </div>
            ) : null}
            <div>
              <p className={columnHeading}>Help</p>
              <div className={column}>
                <Link href="/account" className={linkClass}>
                  My account
                </Link>
                {shop.contactEmail ? (
                  <a href={`mailto:${shop.contactEmail}`} className={linkClass}>
                    Email us
                  </a>
                ) : null}
              </div>
            </div>
            {policyLinks.length > 0 ? (
              <div>
                <p className={columnHeading}>Policies</p>
                <div className={column}>{policyLinks}</div>
              </div>
            ) : null}
          </nav>
        </div>
        {dark ? (
          <p
            aria-hidden="true"
            className="t-display mt-16 hidden overflow-hidden whitespace-nowrap sm:block text-[clamp(3rem,11vw,9rem)] leading-none text-[color-mix(in_oklab,var(--store-text)_9%,var(--store-bg))] select-none"
          >
            {shop.name}
          </p>
        ) : null}
        <div
          className={`flex flex-col gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between ${dark ? 'mt-6' : 'mt-16'}`}
        >
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>
              © {year} {shop.name}
            </span>
            {currencyNote}
          </p>
          {backToTop}
        </div>
      </div>
    </footer>
  );
}
