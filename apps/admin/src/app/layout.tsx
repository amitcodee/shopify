import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

// Per-request rendering is required for the CSP nonce (see src/proxy.ts) to reach Next's scripts.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Merchant Admin',
  description: 'Manage your stores, products, and orders.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-canvas font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
