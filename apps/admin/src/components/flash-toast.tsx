'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from '@/lib/toast';

/**
 * Shows a one-off success toast for a redirect flag (e.g. `?created=1`) and then removes the
 * flag from the URL, so a refresh or a shared link doesn't show it again.
 */
export function FlashToast({ message, param }: { message: string; param: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams.has(param)) return;
    toast(message);
    const rest = new URLSearchParams(searchParams);
    rest.delete(param);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [message, param, pathname, router, searchParams]);

  return null;
}
