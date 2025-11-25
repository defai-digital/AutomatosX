import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node24',
  splitting: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [
    '@ax/core',
    '@ax/schemas',
    '@ax/providers',
    '@ax/algorithms',
  ],
});
