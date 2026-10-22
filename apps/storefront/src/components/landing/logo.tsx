/** The Commerce Platform mark and wordmark. */
export function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4.5 text-white">
          <path
            d="M5 8h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Zm4 0V7a3 3 0 0 1 6 0v1"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={`whitespace-nowrap font-semibold tracking-tight ${tone === 'dark' ? 'text-white' : 'text-slate-900'}`}
      >
        Commerce Platform
      </span>
    </span>
  );
}
