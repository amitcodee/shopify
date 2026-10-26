'use client';

import { StoreErrorState } from '@/components/states';

export default function StoreError({ error, retry }: { error: unknown; retry: () => void }) {
  return <StoreErrorState error={error} retry={retry} />;
}
