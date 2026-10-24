import { LoginForm } from '../forms';
import { AuthCard } from '../auth-card';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      intro="Welcome back. Sign in to see your orders and check out faster."
    >
      <LoginForm />
    </AuthCard>
  );
}
