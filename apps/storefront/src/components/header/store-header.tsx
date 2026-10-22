import type { Shop, ThemeSettings } from '@repo/contracts';
import Link from 'next/link';
import { MenuLink } from '@/components/content';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { CartLink } from './cart-link';
import { AccountIcon, SearchIcon } from './icons';
import { MobileMenu } from './mobile-menu';
import { ShopMenu } from './shop-menu';
import { StickyHeader } from './sticky-header';

/**
 * Phones get the same compact bar in every style: menu button, logo, currency and cart (search,
 * links and account move into the slide-in menu). The style decides the wider-screen layout.
 */
const HEADER_CLASSES: Record<
  ThemeSettings['headerStyle'],
  { row: string; logo: string; nav: string; search: string; actions: string; link: string }
> = {
  inline: {
    row: 'py-3 md:py-4',
    logo: 'text-xl md:text-[1.375rem]',
    nav: 'md:order-2 md:flex-1 md:gap-x-7',
    search: 'md:order-3 md:w-52 lg:w-64',
    actions: 'md:order-4',
    link: 'text-sm font-medium',
  },
  centered: {
    row: 'py-3 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-x-6 md:gap-y-4 md:pt-6 md:pb-0',
    logo: 'text-xl md:col-start-2 md:row-start-1 md:text-center md:text-3xl',
    nav: 'md:col-span-3 md:row-start-2 md:justify-center md:gap-x-9 md:pb-4 md:text-xs md:uppercase md:tracking-[0.16em]',
    search: 'md:col-start-1 md:row-start-1 md:w-56 md:justify-self-start lg:w-64',
    actions: 'md:col-start-3 md:row-start-1 md:justify-self-end',
    link: 'text-xs font-semibold',
  },
  stacked: {
    row: 'py-3 md:gap-y-0 md:py-0',
    logo: 'text-xl md:py-5 md:text-2xl',
    nav: 'md:order-4 md:w-full md:gap-x-8 md:border-t md:border-zinc-200 md:py-3',
    search: 'md:order-2 md:ml-auto md:w-64 lg:w-80',
    actions: 'md:order-3',
    link: 'text-sm font-medium',
  },
};

export function StoreHeader({
  shop,
  path,
  itemCount,
}: {
  shop: Shop;
  path: string;
  itemCount: number;
}) {
  const s = shop.theme.settings;
  const c = HEADER_CLASSES[s.headerStyle];
  const linkClass = `nav-link py-1 text-zinc-700 hover:text-zinc-950 ${c.link}`;
  // The "Shop" dropdown only earns its place when the menu does not already list every collection.
  const menuHrefs = new Set(shop.menus.main.map((link) => link.href));
  const showShopMenu =
    shop.collections.length > 0 &&
    shop.collections.some((col) => !menuHrefs.has(`/collections/${col.handle}`));

  return (
    <StickyHeader sticky={s.stickyHeader} className="store-header">
      <div
        className={`mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-3 px-4 md:gap-x-6 ${c.row}`}
      >
        <MobileMenu shopName={shop.name} links={shop.menus.main} collections={shop.collections} />
        <Link
          href="/"
          className={`order-1 min-w-0 flex-1 truncate font-heading font-bold tracking-tight text-brand md:flex-none ${c.logo}`}
        >
          {shop.name}
        </Link>
        <nav
          aria-label="Main"
          className={`order-4 hidden flex-wrap items-center gap-x-6 gap-y-1 md:flex ${c.nav}`}
        >
          {showShopMenu ? (
            <ShopMenu collections={shop.collections} linkClassName={linkClass} />
          ) : null}
          {shop.menus.main.map((link) => (
            <MenuLink key={`${link.title}-${link.href}`} link={link} className={linkClass} />
          ))}
        </nav>
        <form action="/search" role="search" className={`relative hidden md:flex ${c.search}`}>
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <SearchIcon
            width="16"
            height="16"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500"
          />
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search"
            className="header-search w-full rounded-md border border-zinc-200 bg-zinc-50 py-2 pr-3 pl-9 text-sm placeholder:text-zinc-500"
          />
        </form>
        <div
          className={`order-2 ml-auto flex shrink-0 items-center gap-0.5 md:ml-0 md:gap-1 ${c.actions}`}
        >
          {shop.currencies.length > 1 ? (
            <div className="mr-1">
              <CurrencySwitcher
                current={shop.currency}
                currencies={shop.currencies}
                returnPath={path}
              />
            </div>
          ) : null}
          <Link
            href="/search"
            className="header-icon inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-800 hover:bg-zinc-100 md:hidden"
          >
            <SearchIcon width="21" height="21" />
            <span className="sr-only">Search</span>
          </Link>
          <Link
            href="/account"
            className="header-icon hidden h-10 w-10 items-center justify-center rounded-full text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950 md:inline-flex"
          >
            <AccountIcon width="22" height="22" />
            <span className="sr-only">Account</span>
          </Link>
          <CartLink count={itemCount} drawer={s.cartStyle === 'drawer'} />
        </div>
      </div>
    </StickyHeader>
  );
}
