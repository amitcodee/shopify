import type { CurrentUser } from '@repo/contracts';
import Link from 'next/link';
import { logoutAction } from '@/app/(auth)/actions';
import { LogoMark } from './logo';

export function TopBar({ user, children }: { user: CurrentUser; children?: React.ReactNode }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-4">
        <Link
          href="/stores"
          className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-indigo-600"
        >
          <LogoMark className="h-7 w-7" />
          <span className="sr-only sm:not-sr-only">Commerce Platform</span>
        </Link>
        {children}
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user.platformRole === 'SUPER_ADMIN' ? (
          <Link href="/platform" className="font-medium text-slate-700 hover:text-slate-900">
            Platform admin
          </Link>
        ) : null}
        <Link
          href="/account/security"
          className="hidden text-slate-500 hover:text-slate-900 sm:inline"
        >
          {user.email}
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="font-medium text-slate-700 hover:text-slate-900">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
