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
      className={`flex w-full max-w-md flex-col gap-2 rounded-lg p-1.5 sm:flex-row ${
        dark
          ? 'bg-white/10 ring-1 ring-white/25 backdrop-blur-xl'
          : 'bg-[#05090c]/85 shadow-[0_10px_30px_-12px_rgb(10_34_54/0.25)] ring-1 ring-white/10 backdrop-blur-xl'
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
        className={`min-w-0 flex-1 rounded-md bg-transparent px-4 py-3 text-[0.9375rem] outline-none focus-visible:ring-2 focus-visible:ring-azure-400 ${
          dark ? 'text-white placeholder:text-slate-300' : 'text-white placeholder:text-slate-400'
        }`}
      />
      <button
        type="submit"
        className={`rounded-md px-6 py-3 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
          dark
            ? 'bg-white text-slate-950 hover:bg-slate-200 focus-visible:outline-white'
            : 'bg-white/[0.04] text-slate-950 hover:bg-white/15 focus-visible:outline-white'
        }`}
      >
        Start for free
      </button>
    </form>
  );
}
