import Link from 'next/link';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { forgotPasswordAction } from '../recovery-actions';

export const metadata = { title: 'Forgot password · Merchant Admin' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[22px] leading-8 font-semibold tracking-tight text-slate-900">
        Reset your password
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter your account email and we&apos;ll send you a link to choose a new password.
      </p>
      <ActionForm action={forgotPasswordAction} className="mt-6 space-y-4">
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <SubmitButton fullWidth>Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-slate-500">
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
