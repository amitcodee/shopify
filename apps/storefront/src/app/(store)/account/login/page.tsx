import { LoginForm } from '../forms';
import { AuthCard } from '../auth-card';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      intro="Welcome back. Sign in to see your orders and check out faster."
    >
      <LoginForm next={typeof next === 'string' ? next.slice(0, 300) : undefined} />
    </AuthCard>
  );
}
