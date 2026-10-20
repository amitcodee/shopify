import type { ReactNode } from 'react';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl">{children}</div>;
}
