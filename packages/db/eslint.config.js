import { globalIgnores } from 'eslint/config';
import { createBaseConfig } from '@repo/eslint-config/base';

export default [
  ...createBaseConfig(import.meta.dirname),
  globalIgnores(['src/generated/**', 'scripts/**']),
];
