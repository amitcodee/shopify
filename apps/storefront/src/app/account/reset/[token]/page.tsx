import { SetPasswordForm } from '../../forms';

export const metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Choose a new password</h1>
      <SetPasswordForm purpose="reset" token={token} />
    </div>
  );
}
