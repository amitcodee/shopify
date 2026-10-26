import { ActionForm, Field, SubmitButton } from '@/components/form';
import { resetPasswordAction } from '../../recovery-actions';

export const metadata = { title: 'Choose a new password · Merchant Admin' };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-[22px] leading-8 font-semibold tracking-tight text-slate-900">
        Choose a new password
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        You&apos;ll be signed out on every device. Two-factor authentication stays on.
      </p>
      <ActionForm action={resetPasswordAction.bind(null, token)} className="mt-6 space-y-4">
        <Field
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          hint="At least 12 characters."
        />
        <SubmitButton fullWidth>Save new password</SubmitButton>
      </ActionForm>
    </>
  );
}
