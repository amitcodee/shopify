'use server';

import type { CreatedInvitation } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';
import { type FormState, requiredString, toFormState } from '@/lib/form';

const path = (storeId: string) => `/s/${storeId}/settings/staff`;

export async function inviteStaffAction(
  storeId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const role = requiredString(formData, 'role');
  let invitation: CreatedInvitation;
  try {
    invitation = await api<CreatedInvitation>(`/admin/stores/${storeId}/staff/invitations`, {
      method: 'POST',
      body: {
        email: requiredString(formData, 'email'),
        role,
        permissions: role === 'STAFF' ? formData.getAll('permissions').map(String) : [],
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  revalidatePath(path(storeId));
  return {
    success: `Invitation sent to ${invitation.email}. The link in the email expires in 7 days.`,
  };
}

export async function updateMemberAction(
  storeId: string,
  memberId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const role = requiredString(formData, 'role');
  try {
    await api(`/admin/stores/${storeId}/staff/members/${memberId}`, {
      method: 'PATCH',
      body: {
        role,
        permissions: role === 'STAFF' ? formData.getAll('permissions').map(String) : [],
      },
    });
  } catch (error) {
    return toFormState(error);
  }
  revalidatePath(path(storeId));
  return { success: 'Access updated.' };
}

export async function removeMemberAction(storeId: string, memberId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/staff/members/${memberId}`, { method: 'DELETE' });
  revalidatePath(path(storeId));
}

export async function revokeInvitationAction(storeId: string, invitationId: string): Promise<void> {
  await api(`/admin/stores/${storeId}/staff/invitations/${invitationId}`, { method: 'DELETE' });
  revalidatePath(path(storeId));
}
