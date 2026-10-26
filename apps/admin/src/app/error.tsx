'use client';

import { ErrorState } from '@/components/states';

/** Errors outside the store and platform shells (store list, onboarding, account pages). */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main>
      <ErrorState error={error} retry={retry} />
    </main>
  );
}
