import type { InvitationPreview } from '@repo/contracts';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { Alert } from '@/components/ui';
import { api, ApiError, SESSION_COOKIE } from '@/lib/api';
import { acceptInvitationAction } from './actions';

export const metadata = { title: 'Accept invitation · Merchant Admin' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let preview: InvitationPreview | null = null;
  try {
    preview = await api<InvitationPreview>(`/invitations/${encodeURIComponent(token)}`, {
      auth: false,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  const signedIn = (await cookies()).has(SESSION_COOKIE);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        {!preview ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Invitation not valid
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              This invitation has expired, was revoked, or was already used.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Join {preview.storeName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              You were invited as <strong>{preview.role.toLowerCase()}</strong> ({preview.email}).
            </p>
            <ActionForm
              action={acceptInvitationAction.bind(null, token)}
              className="mt-6 space-y-4"
            >
              {preview.accountExists ? (
                signedIn ? (
                  <Alert tone="info">Accept while signed in as {preview.email}.</Alert>
                ) : (
                  <Alert tone="info">
                    You already have an account.{' '}
                    <Link className="font-medium underline" href={`/login?next=/invite/${token}`}>
                      Sign in as {preview.email}
                    </Link>{' '}
                    first.
                  </Alert>
                )
              ) : (
                <>
                  <Field name="name" label="Your name" required maxLength={100} />
                  <Field
                    name="password"
                    label="Choose a password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                  />
                </>
              )}
              <SubmitButton>Accept invitation</SubmitButton>
            </ActionForm>
          </>
        )}
      </div>
    </main>
  );
}
