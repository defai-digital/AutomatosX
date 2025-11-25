import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/base.ts',
    'src/claude.ts',
    'src/gemini.ts',
    'src/ax-cli.ts',
    'src/openai.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node24',
  splitting: false,
});
