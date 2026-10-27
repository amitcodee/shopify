'use client';

import './globals.css';
import { StoreErrorState } from '@/components/states';

/** The root layout itself failed; this replaces it, so it renders its own document. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        <title>Something went wrong</title>
        <main>
          <StoreErrorState error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
