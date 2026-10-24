import Link from 'next/link';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { signupAction } from '../actions';

export const metadata = { title: 'Create account · Merchant Admin' };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">Start selling in minutes.</p>
      <ActionForm action={signupAction} className="mt-6 space-y-4">
        <Field name="name" label="Your name" autoComplete="name" required maxLength={100} />
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          hint="At least 12 characters."
        />
        <SubmitButton>Create account</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-500">
          Sign in
        </Link>
      </p>
    </>
  );
}
