import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/toaster';
import { THEME_SCRIPT } from '@/lib/theme-script';
import './globals.css';

// Per-request rendering is required for the CSP nonce (see src/proxy.ts) to reach Next's scripts.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Merchant Admin',
  description: 'Manage your stores, products, and orders.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-canvas text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
