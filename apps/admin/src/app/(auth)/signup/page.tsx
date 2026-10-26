import { findThemeTemplate } from '@repo/contracts';
import Link from 'next/link';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { linkClass } from '@/components/ui';
import { signupAction } from '../actions';

export const metadata = { title: 'Create account · Merchant Admin' };

/** `?email=` and `?template=` come from the marketing site's sign-up links. */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; template?: string }>;
}) {
  const { email, template: templateId } = await searchParams;
  const template = templateId ? findThemeTemplate(templateId) : undefined;
  return (
    <>
      <h1 className="text-[22px] leading-8 font-semibold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-slate-500">Start selling in minutes.</p>
      {template ? (
        <p className="mt-4 rounded-lg bg-indigo-50 px-3.5 py-2.5 text-sm text-indigo-900 ring-1 ring-indigo-600/10 ring-inset">
          Your store will start with the “{template.name}” template ({template.industryLabel} ·{' '}
          {template.styleLabel}).
        </p>
      ) : null}
      <ActionForm action={signupAction} className="mt-6 space-y-4">
        <Field name="name" label="Your name" autoComplete="name" required maxLength={100} />
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          defaultValue={email?.slice(0, 254)}
        />
        {template ? <input type="hidden" name="template" value={template.id} /> : null}
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          hint="At least 12 characters."
        />
        <SubmitButton fullWidth>Create account</SubmitButton>
      </ActionForm>
      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className={linkClass}>
          Sign in
        </Link>
      </p>
    </>
  );
}
