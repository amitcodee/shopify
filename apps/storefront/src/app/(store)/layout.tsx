import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getShop } from '@/lib/shop';

/** Store-only routes: a 404 on the root host and on hosts without a store. */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  if (!(await getShop())) notFound();
  return children;
}
