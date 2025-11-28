import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/memory/index.ts',
    'src/config/index.ts',
    'src/router/index.ts',
    'src/session/index.ts',
    'src/agent/index.ts',
  ],
  format: ['esm'],
  dts: {
    compilerOptions: {
      composite: false,
    },
  },
  clean: true,
  sourcemap: true,
  target: 'node24',
  splitting: false,
  external: [
    'better-sqlite3',
    '@ax/algorithms',
    '@ax/providers',
    '@ax/schemas',
  ],
});
