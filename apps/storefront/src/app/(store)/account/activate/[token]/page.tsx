import { SetPasswordForm } from '../../forms';
import { AuthCard } from '../../auth-card';

export const metadata = { title: 'Activate account', robots: { index: false } };

export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthCard
      title="Activate your account"
      intro="Choose a password to finish setting up your account."
    >
      <SetPasswordForm purpose="activate" token={token} />
    </AuthCard>
  );
}
