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
      <footer className="store-footer border-t border-zinc-200 py-10 text-sm text-zinc-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 text-center">
          <SocialLinks settings={s} className="justify-center" />
          {hasLinks ? (
            <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {menuLinks}
              {policyLinks}
            </nav>
          ) : null}
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
  const columnHeading = 'eyebrow mb-4 text-zinc-900';
  return (
    <footer
      className={`store-footer pt-14 pb-8 text-sm text-zinc-600 ${
        dark ? 'theme-band' : 'border-t border-zinc-200 bg-surface'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p
              className={`font-heading font-bold tracking-tight text-zinc-900 ${dark ? 'text-2xl' : 'text-xl'}`}
            >
              {shop.name}
            </p>
            <p className="mt-3 leading-relaxed">Questions about an order? Write to us at</p>
            <p className="break-words">{email}</p>
            <SocialLinks settings={s} className="mt-6" />
          </div>
          {hasLinks ? (
            <nav
              aria-label="Footer"
              className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7 md:col-start-6"
            >
              {menuLinks.length > 0 ? (
                <div>
                  <p className={columnHeading}>Explore</p>
                  <div className="flex flex-col items-start gap-2.5">{menuLinks}</div>
                </div>
              ) : null}
              {policyLinks.length > 0 ? (
                <div>
                  <p className={columnHeading}>Policies</p>
                  <div className="flex flex-col items-start gap-2.5">{policyLinks}</div>
                </div>
              ) : null}
            </nav>
          ) : null}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
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
