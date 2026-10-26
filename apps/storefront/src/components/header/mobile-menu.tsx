'use client';

import type { ResolvedLink } from '@repo/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MenuLink } from '@/components/content';
import { AccountIcon, ArrowRightIcon, CloseIcon, MenuIcon, SearchIcon } from './icons';
import { useDrawer } from './use-drawer';

/**
 * Phone navigation: a menu button that slides in a panel from the left with search, the main
 * menu, the store's collections and the account link. Portalled to <body> because the sticky
 * header's backdrop blur would otherwise become the panel's containing block. It only mounts
 * after a click, so `document` is always there.
 */
export function MobileMenu({
  shopName,
  links,
  collections,
}: {
  shopName: string;
  links: ResolvedLink[];
  collections: { title: string; handle: string }[];
}) {
  const panel = useRef<HTMLDivElement>(null);
  const { state, isOpen, open, close } = useDrawer(panel);
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    close();
  }, [pathname, close]);

  // Collections the main menu already links to are not listed twice.
  const linked = new Set(links.map((link) => link.href));
  const extraCollections = collections.filter((c) => !linked.has(`/collections/${c.handle}`));
  const row =
    'flex items-center justify-between border-b border-zinc-200 py-3.5 text-base text-zinc-900';
  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="header-icon -ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-800 hover:bg-zinc-100 md:hidden"
      >
        <MenuIcon width="22" height="22" />
        <span className="sr-only">Menu</span>
      </button>
      {state !== 'closed'
        ? createPortal(
            <div className="drawer-root fixed inset-0 z-50 md:hidden" data-state={state}>
              <div className="drawer-overlay absolute inset-0" aria-hidden="true" onClick={close} />
              <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                tabIndex={-1}
                className="drawer-panel drawer-left absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col bg-page text-ink shadow-2xl focus:outline-none"
              >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
                  <p className="truncate font-heading text-lg font-bold text-brand">{shopName}</p>
                  <button
                    type="button"
                    onClick={close}
                    data-autofocus
                    className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100"
                  >
                    <CloseIcon />
                    <span className="sr-only">Close menu</span>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
                  <form action="/search" role="search" className="relative mt-4">
                    <label htmlFor="menu-search" className="sr-only">
                      Search products
                    </label>
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
                    <input
                      id="menu-search"
                      name="q"
                      type="search"
                      placeholder="Search products"
                      className="w-full rounded-md border border-zinc-300 bg-transparent py-2.5 pr-3 pl-10 text-base placeholder:text-zinc-500"
                    />
                  </form>
                  {links.length > 0 ? (
                    <nav aria-label="Menu links" className="mt-4">
                      {links.map((link) => (
                        <MenuLink
                          key={`${link.title}-${link.href}`}
                          link={link}
                          className={`${row} font-medium`}
                        />
                      ))}
                    </nav>
                  ) : null}
                  {extraCollections.length > 0 ? (
                    <div className="mt-8">
                      <p className="eyebrow text-zinc-500">Collections</p>
                      <ul className="mt-2">
                        {extraCollections.map((c) => (
                          <li key={c.handle}>
                            <Link href={`/collections/${c.handle}`} className={row}>
                              {c.title}
                              <ArrowRightIcon className="text-zinc-400" />
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link href="/collections/all" className={`${row} font-medium`}>
                            Shop all products
                            <ArrowRightIcon className="text-zinc-400" />
                          </Link>
                        </li>
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-zinc-200 px-5 py-4">
                  <Link
                    href="/account"
                    className="flex items-center gap-3 text-sm font-medium text-zinc-900"
                  >
                    <AccountIcon />
                    Account
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
