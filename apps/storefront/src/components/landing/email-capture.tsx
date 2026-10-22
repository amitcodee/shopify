import { useId } from 'react';

/**
 * "Enter your email → Start for free": a plain GET form to the admin sign-up, which prefills the
 * email (the storefront CSP allows form submissions to the admin origin).
 */
export function EmailCapture({
  signupUrl,
  tone = 'dark',
}: {
  signupUrl: string;
  tone?: 'dark' | 'light';
}) {
  const id = useId();
  const dark = tone === 'dark';
  return (
    <form
      action={signupUrl}
      method="get"
      className={`flex w-full max-w-md flex-col gap-2 rounded-2xl p-1.5 sm:flex-row sm:rounded-full ${
        dark ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white ring-1 ring-slate-300'
      }`}
    >
      <label htmlFor={id} className="sr-only">
        Email address
      </label>
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
        className={`min-w-0 flex-1 rounded-full bg-transparent px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          dark
            ? 'text-white placeholder:text-slate-400'
            : 'text-slate-900 placeholder:text-slate-500'
        }`}
      />
      <button
        type="submit"
        className={`rounded-full px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${
          dark
            ? 'bg-white text-slate-950 hover:bg-indigo-100 focus-visible:outline-white'
            : 'bg-slate-950 text-white hover:bg-slate-800 focus-visible:outline-indigo-600'
        }`}
      >
        Start for free
      </button>
    </form>
  );
}
