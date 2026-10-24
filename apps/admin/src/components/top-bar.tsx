import type { CurrentUser } from '@repo/contracts';
import Link from 'next/link';
import { logoutAction } from '@/app/(auth)/actions';
import { Icon, LogoMark } from './icons';

function initials(user: CurrentUser): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/**
 * Sticky top bar. Inside the app shell the sidebar already shows the logo, so `inShell` hides
 * it on desktop and keeps it on small screens where the sidebar is not rendered.
 */
export function TopBar({
  user,
  children,
  inShell = false,
}: {
  user: CurrentUser;
  children?: React.ReactNode;
  inShell?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/stores"
          className={`flex items-center gap-2.5 text-sm font-semibold tracking-tight text-slate-900 ${inShell ? 'md:hidden' : ''}`}
        >
          <LogoMark className="size-7" />
          <span className={inShell ? 'sr-only' : 'hidden sm:inline'}>Commerce Platform</span>
        </Link>
        {children ? (
          <div className="flex min-w-0 items-center gap-2 text-sm [&>span:first-child]:text-slate-300">
            {children}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 text-sm">
        {user.platformRole === 'SUPER_ADMIN' ? (
          <Link
            href="/platform"
            className="mr-1 hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 sm:inline-flex"
          >
            <Icon name="shield" className="size-4" />
            Platform admin
          </Link>
        ) : null}
        <Link
          href="/account/security"
          title="Account security"
          className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-1 hover:bg-slate-900/5 sm:pr-3"
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-semibold text-white"
          >
            {initials(user)}
          </span>
          <span className="hidden max-w-48 truncate text-slate-600 lg:inline">{user.email}</span>
          <span className="sr-only lg:hidden">{user.email}</span>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
          >
            <Icon name="logout" className="size-4" />
            <span className="max-sm:sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
