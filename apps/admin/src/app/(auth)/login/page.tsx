import Link from 'next/link';
import { Alert } from '@/components/ui';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in · Merchant Admin' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const { next, expired } = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your stores, products and orders.</p>
      {expired ? (
        <div className="mt-4">
          <Alert tone="info">Your session ended. Please sign in again.</Alert>
        </div>
      ) : null}
      <LoginForm next={next ?? '/stores'} />
      <p className="mt-6 text-sm text-slate-500">
        New here?{' '}
        <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
          Create an account
        </Link>
      </p>
    </>
  );
}
