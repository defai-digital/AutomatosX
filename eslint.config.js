// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
// v12.4.0: Custom AutomatosX ESLint rules for preventing timer/resource leaks
import automatosxPlugin from './tools/eslint-plugin-automatosx/lib/index.js';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.js',
      '*.d.ts',
      'examples/**',
      'tests/e2e/**',  // e2e tests have different tsconfig
      '!eslint.config.js',  // Don't ignore this config file
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Main source code configuration
  {
    files: ['src/**/*.ts'],
    plugins: {
      // v12.4.0: Custom AutomatosX rules for preventing timer/resource leaks
      automatosx: automatosxPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      // v12.4.0: Allow underscore-prefixed unused vars (common convention for intentionally unused params)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      // v12.4.0: AutomatosX custom rules (lenient mode - warn only)
      // These rules help catch timer leaks and resource management issues
      'automatosx/no-interval-without-unref': 'warn',
      'automatosx/eventemitter-requires-destroy': 'warn',
      'automatosx/timeout-must-clear-on-error': 'off', // Too many false positives in existing code
    },
  },

  // Test files configuration
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // v12.4.0: Allow underscore-prefixed unused vars in tests
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-console': 'off',
    },
  }
);
