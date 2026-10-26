import Link from 'next/link';
import type { ReactNode } from 'react';
import { ProductIcon, type ProductIconName } from './icons';

/** A friendly "nothing here" panel with a way onwards. */
export function EmptyState({
  icon = 'search',
  title,
  children,
  action,
}: {
  icon?: ProductIconName;
  title: string;
  children?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface text-zinc-700">
        <ProductIcon name={icon} className="size-6" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-zinc-900">{title}</h2>
      {children ? <div className="mt-2 max-w-md text-sm text-zinc-600">{children}</div> : null}
      {action ? (
        <Link href={action.href} className="btn mt-6 px-5 py-2.5 text-sm">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
