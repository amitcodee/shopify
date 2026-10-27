'use client';

import './globals.css';
import { ErrorState } from '@/components/states';

/** The root layout itself failed; this replaces it, so it renders its own document. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-slate-900 antialiased">
        <title>Something went wrong · Merchant Admin</title>
        <main>
          <ErrorState error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
