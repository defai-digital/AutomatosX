import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  external: ['vscode'],
  noExternal: ['@ax/schemas'],
  minify: false,
  treeshake: true,
});
