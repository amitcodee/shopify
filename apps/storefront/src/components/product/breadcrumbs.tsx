import Link from 'next/link';

export interface Crumb {
  label: string;
  /** Omitted for the current page (the last crumb). */
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-xs text-zinc-500 sm:text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`} className="flex min-w-0 items-center gap-2">
            {i > 0 ? (
              <span aria-hidden="true" className="text-zinc-300">
                /
              </span>
            ) : null}
            {item.href ? (
              <Link href={item.href} className="transition hover:text-zinc-900 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-[16rem] truncate text-zinc-800">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
