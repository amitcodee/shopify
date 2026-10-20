import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Container builds set NEXT_OUTPUT=standalone (self-contained server, see Dockerfile).
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Product image uploads pass through server actions (API limit is 5 MB).
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    // Product media is served by the API (a CDN in production).
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }],
  },
};

export default nextConfig;
