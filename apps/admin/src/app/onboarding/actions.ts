'use server';

import type { StoreSummary } from '@repo/contracts';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { type FormState, requiredString, toFormState } from '@/lib/form';

export async function createStoreAction(_: FormState, formData: FormData): Promise<FormState> {
  let store: StoreSummary;
  try {
    store = await api<StoreSummary>('/admin/stores', {
      method: 'POST',
      body: {
        name: requiredString(formData, 'name'),
        subdomain: requiredString(formData, 'subdomain'),
        contactEmail: requiredString(formData, 'contactEmail'),
        currency: requiredString(formData, 'currency'),
      },
    });
  } catch (error) {
    return toFormState(error, formData);
  }
  redirect(`/s/${store.id}`);
}
