import { RegisterForm } from '../forms';

export const metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Create account</h1>
      <RegisterForm />
    </div>
  );
}
