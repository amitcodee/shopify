import { StoreSkeleton } from '@/components/states';

/** Shown between the store's header and footer while a store page loads. */
export default function Loading() {
  return <StoreSkeleton />;
}
