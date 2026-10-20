'use client';

import type { ReactNode } from 'react';
import { ActionForm } from '@/components/form';
import type { FormState } from '@/lib/form';

/** Invite form; on success the action returns the accept link to share manually if needed. */
export function InviteResult({
  action,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
}) {
  return (
    <ActionForm action={action} className="max-w-xl space-y-4">
      {children}
    </ActionForm>
  );
}
