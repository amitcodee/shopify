import { SetPasswordForm } from '../../forms';
import { AuthCard } from '../../auth-card';

export const metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthCard title="Choose a new password">
      <SetPasswordForm purpose="reset" token={token} />
    </AuthCard>
  );
}
