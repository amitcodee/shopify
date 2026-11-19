import type { Rating } from '@repo/contracts';

const STAR =
  'M10 1.6l2.47 5.2 5.7.68-4.2 3.92 1.08 5.64L10 14.27l-5.05 2.77 1.08-5.64-4.2-3.92 5.7-.68z';

/** Five stars filled to `value` (0-5), e.g. 4.5 fills four and a half. */
export function Stars({
  value,
  className = 'size-4',
  label,
}: {
  value: number;
  className?: string;
  /** Read out instead of the default "4.5 out of 5 stars". */
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label ?? `${value} out of 5 stars`}
      className="inline-flex items-center gap-0.5"
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} aria-hidden="true" className={`relative inline-block ${className}`}>
            <svg viewBox="0 0 20 20" className="absolute inset-0 size-full text-zinc-300">
              <path d={STAR} fill="currentColor" />
            </svg>
            {fill > 0 ? (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <svg viewBox="0 0 20 20" className={`${className} text-amber-500`}>
                  <path d={STAR} fill="currentColor" />
                </svg>
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

/** Stars plus "4.5 (12)" for product cards and the product header. */
export function RatingSummary({
  rating,
  className = 'size-3.5',
  text = 'text-xs',
}: {
  rating: Rating;
  className?: string;
  text?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${text} text-zinc-600`}>
      <Stars value={rating.average} className={className} />
      <span>
        {rating.average.toFixed(1)}
        <span className="text-zinc-400"> ({rating.count})</span>
        <span className="sr-only"> {rating.count === 1 ? 'review' : 'reviews'}</span>
      </span>
    </span>
  );
}
