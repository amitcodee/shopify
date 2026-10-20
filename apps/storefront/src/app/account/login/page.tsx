import { LoginForm } from '../forms';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Sign in</h1>
      <LoginForm />
    </div>
  );
}
