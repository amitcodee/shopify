import type { ReactNode } from 'react';

/** Sign-in, sign-up and password pages: a centered card with a title and short intro. */
export function AuthCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="panel mx-auto w-full max-w-md px-5 py-8 sm:px-10 sm:py-12">
      <h1 className="t-title text-center text-3xl sm:text-[2.25rem]">{title}</h1>
      {intro ? <p className="mt-3 text-center text-sm text-zinc-600">{intro}</p> : null}
      <div className="mt-8">{children}</div>
    </div>
  );
}
