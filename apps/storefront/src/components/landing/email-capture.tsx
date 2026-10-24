import { useId } from 'react';

/**
 * "Enter your email → Start for free": a plain GET form to the admin sign-up, which prefills the
 * email (the storefront CSP allows form submissions to the admin origin).
 */
export function EmailCapture({
  signupUrl,
  tone = 'dark',
  template,
}: {
  signupUrl: string;
  tone?: 'dark' | 'light';
  /** Template id to start the store with (sent as `template`). */
  template?: string;
}) {
  const id = useId();
  const dark = tone === 'dark';
  return (
    <form
      action={signupUrl}
      method="get"
      className={`flex w-full max-w-md flex-col gap-2 rounded-2xl p-1.5 sm:flex-row sm:rounded-full ${
        dark
          ? 'bg-white/10 ring-1 ring-white/25 backdrop-blur'
          : 'bg-white shadow-[0_10px_30px_-12px_rgb(15_23_42/0.25)] ring-1 ring-slate-900/10'
      }`}
    >
      {template ? <input type="hidden" name="template" value={template} /> : null}
      <label htmlFor={id} className="sr-only">
        Email address
      </label>
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
        className={`min-w-0 flex-1 rounded-full bg-transparent px-4 py-3 text-[0.9375rem] outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          dark
            ? 'text-white placeholder:text-slate-300'
            : 'text-slate-900 placeholder:text-slate-500'
        }`}
      />
      <button
        type="submit"
        className={`rounded-full px-6 py-3 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
          dark
            ? 'bg-white text-slate-950 hover:bg-indigo-50 focus-visible:outline-white'
            : 'bg-slate-950 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600'
        }`}
      >
        Start for free
      </button>
    </form>
  );
}
