import { redirect } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/form';
import { TopBar } from '@/components/top-bar';
import { getCurrentUser } from '@/lib/session';
import { resendVerificationAction } from './actions';

export const metadata = { title: 'Confirm your email · Merchant Admin' };

export default async function VerifyEmailNoticePage() {
  const user = await getCurrentUser();
  if (user.emailVerified) redirect('/onboarding');
  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check your inbox</h1>
        <p className="mt-1 text-sm text-slate-500">
          We sent a link to <strong>{user.email}</strong>. Open it to confirm your email address,
          then you can create your store. The link expires in 24 hours.
        </p>
        <div className="mt-8 rounded-xl border border-slate-200/90 bg-white p-6 shadow-card">
          <ActionForm action={resendVerificationAction}>
            <p className="text-sm text-slate-600">Didn&apos;t get it? Check your spam folder.</p>
            <SubmitButton variant="secondary">Send a new link</SubmitButton>
          </ActionForm>
        </div>
      </main>
    </>
  );
}
