import type { CurrentUser } from '@repo/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { LogoMark } from './icons';
import { TopBar } from './top-bar';

/**
 * Admin chrome: a fixed dark sidebar (desktop) beside a sticky top bar and the page content.
 * On small screens the sidebar is replaced by `mobileNav` above the content.
 */
export function AppShell({
  user,
  breadcrumb,
  sidebarHeader,
  nav,
  mobileNav,
  sidebarFooter,
  children,
}: {
  user: CurrentUser;
  breadcrumb?: ReactNode;
  sidebarHeader?: ReactNode;
  nav: ReactNode;
  mobileNav: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-shell md:flex">
        <Link
          href="/stores"
          className="flex h-14 shrink-0 items-center gap-2.5 px-5 text-sm font-semibold tracking-tight text-white"
        >
          <LogoMark className="size-7" />
          Commerce Platform
        </Link>
        {sidebarHeader ? <div className="px-3 pb-2">{sidebarHeader}</div> : null}
        <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-color:var(--color-slate-700)_transparent] [scrollbar-width:thin]">
          {nav}
        </div>
        {sidebarFooter ? (
          <div className="shrink-0 border-t border-white/5 p-3">{sidebarFooter}</div>
        ) : null}
      </aside>
      <div className="md:pl-64">
        <TopBar user={user} inShell>
          {breadcrumb}
        </TopBar>
        <div className="border-b border-slate-200/80 bg-white/60 px-4 py-2.5 md:hidden">
          {mobileNav}
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
