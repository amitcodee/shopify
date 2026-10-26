import type { ReactNode } from 'react';
import { ProductIcon } from './icons';

/** A native disclosure (works without JavaScript) styled as a ruled accordion row. */
export function Accordion({
  title,
  open = false,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group border-b border-zinc-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
        {title}
        <ProductIcon
          name="chevronDown"
          className="size-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="pb-6 text-sm leading-relaxed text-zinc-600">{children}</div>
    </details>
  );
}
