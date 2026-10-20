'use server';

import type { AuthSession } from '@repo/contracts';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, optionalString, toFormState } from '@/lib/form';
import { setSessionCookie } from '@/lib/session';

export async function acceptInvitationAction(
  token: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  let result: { storeId: string; session: AuthSession | null };
  try {
    result = await api(`/invitations/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      body: {
        name: optionalString(formData, 'name'),
        password: optionalString(formData, 'password'),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  if (result.session) await setSessionCookie(result.session.token, result.session.expiresAt);
  redirect(`/s/${result.storeId}`);
}
