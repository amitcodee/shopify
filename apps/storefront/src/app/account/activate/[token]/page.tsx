import { SetPasswordForm } from '../../forms';

export const metadata = { title: 'Activate account', robots: { index: false } };

export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Activate your account</h1>
      <p className="mb-6 text-sm text-zinc-600">
        Choose a password to finish setting up your account.
      </p>
      <SetPasswordForm purpose="activate" token={token} />
    </div>
  );
}
