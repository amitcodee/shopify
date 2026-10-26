import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/toaster';
import './globals.css';

// Per-request rendering is required for the CSP nonce (see src/proxy.ts) to reach Next's scripts.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Merchant Admin',
  description: 'Manage your stores, products, and orders.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
