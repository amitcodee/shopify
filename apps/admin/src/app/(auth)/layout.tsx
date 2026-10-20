import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-indigo-600">
          Commerce Platform
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
