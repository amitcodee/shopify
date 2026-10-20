'use client';

import { useEffect } from 'react';

/**
 * Performs a full browser navigation when a server action returns `redirectTo`. Used instead
 * of server-side redirects for checkout/payment hops so the next request carries the shopper's
 * own Host header (which selects the store) — and so external payment pages load normally.
 */
export function FollowRedirect({ to }: { to?: string }) {
  useEffect(() => {
    if (to) window.location.assign(to);
  }, [to]);
  return null;
}
