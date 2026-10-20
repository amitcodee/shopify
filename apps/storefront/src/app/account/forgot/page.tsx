import { ForgotForm } from '../forms';

export const metadata = { title: 'Reset password' };

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Reset your password</h1>
      <ForgotForm />
    </div>
  );
}
