'use client';

import { ErrorState } from '@/components/states';

/** A store page failed to render: keep the shell and offer a retry. */
export default function StoreError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} />;
}
