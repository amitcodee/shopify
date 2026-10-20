// ESLint config for Next.js apps (core web vitals + TypeScript rules from eslint-config-next).
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export const nextConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Server actions used with useActionState receive a previous-state argument they may ignore.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
