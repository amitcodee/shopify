import { PlatformNotFound } from '@/components/platform-landing';
import { requestHost } from '@/lib/api';
import { isRootHost } from '@/lib/shop';

/**
 * not-found UI for the marketing routes' dynamic segments: the marketing 404 on the root host,
 * a plain store-style message on store hosts (where these routes never exist).
 */
export async function SegmentNotFound() {
  if (isRootHost(await requestHost())) return <PlatformNotFound />;
  return (
    <div className="py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-zinc-600">The page you are looking for does not exist.</p>
    </div>
  );
}
