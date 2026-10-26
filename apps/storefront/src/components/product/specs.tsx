import type { StorefrontProduct } from '@repo/contracts';
import type { ReactNode } from 'react';
import { Accordion } from './accordion';

type Spec = NonNullable<StorefrontProduct['specs']>[number];

const DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

/** Only https links are rendered as links; anything else stays plain text. */
function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** A spec's value as plain text (or a link for URLs), never as HTML. */
function SpecValue({ spec }: { spec: Spec }): ReactNode {
  switch (spec.type) {
    case 'boolean':
      return spec.value === 'true' ? 'Yes' : spec.value === 'false' ? 'No' : spec.value;
    case 'date': {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(spec.value)
        ? new Date(`${spec.value}T00:00:00Z`)
        : null;
      return date && !Number.isNaN(date.getTime()) ? (
        <time dateTime={spec.value}>{DATE.format(date)}</time>
      ) : (
        spec.value
      );
    }
    case 'url': {
      const url = httpsUrl(spec.value);
      if (!url) return spec.value;
      const label = `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
      return (
        <a
          href={url.toString()}
          target="_blank"
          rel="nofollow noopener"
          className="font-medium break-all text-zinc-900 underline underline-offset-2"
        >
          {label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      );
    }
    case 'multi_line_text':
      return <span className="whitespace-pre-line">{spec.value}</span>;
    default:
      return spec.value;
  }
}

/** The custom fields the merchant chose to show, as a "Specifications" accordion row. */
export function Specifications({ specs }: { specs: StorefrontProduct['specs'] }) {
  const rows = (specs ?? []).filter((spec) => spec.value.trim() !== '');
  if (rows.length === 0) return null;
  return (
    <Accordion title="Specifications">
      <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-6 text-[0.9375rem]">
        {rows.map((spec) => (
          <div
            key={spec.key}
            className="col-span-2 grid grid-cols-subgrid border-b border-zinc-100 py-2.5 last:border-b-0"
          >
            <dt className="text-zinc-500">{spec.label}</dt>
            <dd className="min-w-0 break-words text-zinc-900">
              <SpecValue spec={spec} />
            </dd>
          </div>
        ))}
      </dl>
    </Accordion>
  );
}
