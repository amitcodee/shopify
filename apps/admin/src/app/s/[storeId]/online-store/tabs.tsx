'use client';

import { usePathname } from 'next/navigation';
import { UnderlineTabs } from '@/components/ui';

const TABS = [
  { label: 'Pages', path: '/pages' },
  { label: 'Blog', path: '/blog' },
  { label: 'Navigation', path: '/navigation' },
  { label: 'Policies', path: '/policies' },
  { label: 'Password', path: '/password' },
];

export function OnlineStoreTabs({ storeId }: { storeId: string }) {
  const pathname = usePathname();
  const base = `/s/${storeId}/online-store`;
  return (
    <UnderlineTabs
      label="Online store"
      items={[
        ...TABS.map((tab) => ({
          label: tab.label,
          href: `${base}${tab.path}`,
          active: pathname.startsWith(`${base}${tab.path}`),
        })),
        { label: 'Theme', href: `/s/${storeId}/settings/theme`, active: false },
      ]}
    />
  );
}
