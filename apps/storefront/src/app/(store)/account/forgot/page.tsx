import { ForgotForm } from '../forms';
import { AuthCard } from '../auth-card';

export const metadata = { title: 'Reset password' };

export default function ForgotPage() {
  return (
    <AuthCard
      title="Reset your password"
      intro="Enter your email and we’ll send you a link to choose a new password."
    >
      <ForgotForm />
    </AuthCard>
  );
}
