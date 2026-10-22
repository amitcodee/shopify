'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { openCartDrawer } from '@/components/cart/cart-events';
import { BagIcon } from './icons';

/**
 * Header cart link. Its accessible name stays "Cart (n)"; with the drawer cart style a plain
 * click opens the drawer instead (the link still goes to /cart without scripts, in a new tab,
 * and on the cart page itself).
 */
export function CartLink({ count, drawer }: { count: number; drawer: boolean }) {
  const pathname = usePathname();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!drawer || pathname === '/cart') return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    openCartDrawer();
  }

  return (
    <Link
      href="/cart"
      onClick={onClick}
      className="header-icon relative inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950"
    >
      <BagIcon width="22" height="22" />
      <span className="sr-only">Cart ({count})</span>
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-brand px-1 text-[0.625rem] leading-none font-bold text-brand-contrast tabular-nums ring-2 ring-[var(--store-bg)]"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
