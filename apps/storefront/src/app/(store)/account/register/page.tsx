import { RegisterForm } from '../forms';
import { AuthCard } from '../auth-card';

export const metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <AuthCard title="Create account" intro="Track orders and check out faster next time.">
      <RegisterForm />
    </AuthCard>
  );
}
