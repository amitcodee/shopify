import Link from 'next/link';
import { Alert, linkClass } from '@/components/ui';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in · Merchant Admin' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string; reset?: string; unlocked?: string }>;
}) {
  const { next, expired, reset, unlocked } = await searchParams;
  return (
    <>
      <h1 className="text-[22px] leading-8 font-semibold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-1.5 text-sm text-slate-500">Manage your stores, products and orders.</p>
      {expired ? (
        <div className="mt-4">
          <Alert tone="info">Your session ended. Please sign in again.</Alert>
        </div>
      ) : null}
      {reset ? (
        <div className="mt-4">
          <Alert tone="success">Password changed. Sign in with your new password.</Alert>
        </div>
      ) : null}
      {unlocked ? (
        <div className="mt-4">
          <Alert tone="success">Your account is unlocked. You can sign in again.</Alert>
        </div>
      ) : null}
      <LoginForm next={next ?? '/stores'} />
      <div className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className={linkClass}>
          Forgot your password?
        </Link>
      </div>
      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
        New here?{' '}
        <Link href="/signup" className={linkClass}>
          Create an account
        </Link>
      </p>
    </>
  );
}
