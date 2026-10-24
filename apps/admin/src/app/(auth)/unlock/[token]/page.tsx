import { ActionForm, SubmitButton } from '@/components/form';
import { unlockAccountAction } from '../../recovery-actions';

export const metadata = { title: 'Unlock your account · Merchant Admin' };

export default async function UnlockPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Unlock your account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your account was locked after too many failed sign-in attempts. If those attempts were
        yours, unlock it and sign in again.
      </p>
      <ActionForm action={unlockAccountAction.bind(null, token)} className="mt-6 space-y-4">
        <SubmitButton>Unlock account</SubmitButton>
      </ActionForm>
    </>
  );
}
