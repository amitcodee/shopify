import { PageSkeleton } from '@/components/states';

/** Shown inside the store shell (sidebar and top bar stay) while a store page loads. */
export default function Loading() {
  return <PageSkeleton />;
}
