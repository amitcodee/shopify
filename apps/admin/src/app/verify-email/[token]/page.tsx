import { ActionForm, SubmitButton } from '@/components/form';
import { confirmEmailAction } from '../actions';

export const metadata = { title: 'Confirm your email · Merchant Admin' };

export default async function ConfirmEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Confirm your email</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirm this address to finish setting up your account.
        </p>
        <ActionForm action={confirmEmailAction.bind(null, token)} className="mt-6 space-y-4">
          <SubmitButton>Confirm email</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
