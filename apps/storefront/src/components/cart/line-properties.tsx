import { formatMoney, type LineProperty } from '@repo/contracts';

/** A cart or order line's personalisation ("Engraving: For Sam (+$5.00)"). */
export function LineProperties({
  properties,
  currency,
  className = 'mt-1 space-y-0.5 text-sm text-zinc-500',
}: {
  properties?: LineProperty[];
  currency: string;
  className?: string;
}) {
  if (!properties?.length) return null;
  return (
    <dl className={className}>
      {properties.map((p) => (
        <div key={p.label} className="flex flex-wrap gap-x-1">
          <dt>{p.label}:</dt>
          <dd className="[overflow-wrap:anywhere] whitespace-pre-line text-zinc-800">
            {p.value}
            {p.price > 0 ? (
              <span className="text-zinc-500"> (+{formatMoney(p.price, currency)})</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
