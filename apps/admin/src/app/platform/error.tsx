'use client';

import { ErrorState } from '@/components/states';

export default function PlatformError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorState error={error} retry={retry} homeHref="/platform" homeLabel="Platform overview" />
  );
}
