// Type-aware ESLint config for Node/TypeScript packages (API, shared libraries).
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * @param {string} tsconfigRootDir - pass `import.meta.dirname` from the consuming package
 */
export function createBaseConfig(tsconfigRootDir) {
  return defineConfig([
    globalIgnores(['dist/**', 'coverage/**', '*.config.*']),
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        globals: globals.node,
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          // Decorator metadata (NestJS DI) needs real value imports for injected classes.
          { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
    {
      // HTTP assertions read untyped response bodies (supertest `res.body` is `any`).
      files: ['test/**/*.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
      },
    },
  ]);
}
