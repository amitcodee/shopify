import Link from 'next/link';

const STEPS = [
  { key: 'cart', label: 'Cart', href: '/cart' },
  { key: 'details', label: 'Details' },
  { key: 'payment', label: 'Payment' },
  { key: 'done', label: 'Confirmation' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

/** Where the shopper is in checkout: finished steps are ticked (cart links back), later ones muted. */
export function CheckoutSteps({ current }: { current: StepKey }) {
  const at = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="flex items-center gap-2 text-xs font-medium sm:gap-3 sm:text-sm">
        {STEPS.map((step, i) => {
          const done = i < at;
          const here = i === at;
          const dot = (
            <span
              aria-hidden="true"
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                done || here
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-300 bg-white text-zinc-500'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
          );
          const label = (
            <span className={here ? 'text-zinc-900' : done ? 'text-zinc-700' : 'text-zinc-400'}>
              {step.label}
            </span>
          );
          return (
            <li
              key={step.key}
              aria-current={here ? 'step' : undefined}
              className="flex min-w-0 items-center gap-2 sm:gap-3"
            >
              {done && 'href' in step ? (
                <Link href={step.href} className="flex items-center gap-2 hover:underline">
                  {dot}
                  {label}
                </Link>
              ) : (
                <span className="flex items-center gap-2">
                  {dot}
                  <span className={here ? '' : 'max-sm:sr-only'}>{label}</span>
                </span>
              )}
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-px w-6 sm:w-10 ${i < at ? 'bg-zinc-900' : 'bg-zinc-300'}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
