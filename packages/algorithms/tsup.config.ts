import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/bindings/index.ts',
    'src/bindings/routing.ts',
    'src/bindings/dag.ts',
    'src/bindings/ranking.ts',
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
});
