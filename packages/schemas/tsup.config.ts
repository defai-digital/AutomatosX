import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/agent.ts',
    'src/config.ts',
    'src/constants.ts',
    'src/format.ts',
    'src/memory.ts',
    'src/provider.ts',
    'src/session.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node24',
  splitting: false,
});
