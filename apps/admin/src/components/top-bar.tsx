import type { CurrentUser } from '@repo/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction } from '@/app/(auth)/actions';
import { Icon } from './icons';
import { LogoMark } from './logo';

function initialOf(text: string): string {
  return (text.trim()[0] ?? '?').toUpperCase();
}

/** The signed-in user: avatar + email (to account security), plus Sign out. */
export function UserMenu({ user }: { user: CurrentUser }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {user.platformRole === 'SUPER_ADMIN' ? (
        <Link
          href="/platform"
          className="mr-1 hidden rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 sm:inline"
        >
          Platform admin
        </Link>
      ) : null}
      <Link
        href="/account/security"
        className="flex min-w-0 items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-semibold text-white"
        >
          {initialOf(user.name || user.email)}
        </span>
        <span className="hidden max-w-[220px] truncate lg:inline">{user.email}</span>
        <span className="sr-only lg:hidden">{user.email}</span>
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 font-medium text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
        >
          <Icon name="logout" className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );
}

/** The bar across signed-in pages that live outside a store (store picker, account, etc.). */
export function TopBar({ user, children }: { user: CurrentUser; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/stores"
            className="flex items-center gap-2 rounded-lg text-sm font-semibold tracking-tight text-slate-900"
          >
            <LogoMark className="h-7 w-7" />
            <span className="sr-only sm:not-sr-only">Commerce Platform</span>
          </Link>
          {children ? (
            <div className="flex min-w-0 items-center gap-2 [&>span:first-child]:text-slate-300">
              {children}
            </div>
          ) : null}
        </div>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
