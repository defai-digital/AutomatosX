import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library export
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node24',
    splitting: false,
    external: ['@ax/core', '@ax/schemas'],
  },
  // Server binary
  {
    entry: ['src/server.ts'],
    format: ['esm'],
    dts: false,
    sourcemap: true,
    target: 'node24',
    splitting: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: ['@ax/core', '@ax/schemas'],
  },
]);
