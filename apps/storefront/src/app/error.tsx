'use client';

import { StoreErrorState } from '@/components/states';

/** Errors on the store homepage and the marketing site (inside their headers and footers). */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <StoreErrorState error={error} retry={retry} />;
}
