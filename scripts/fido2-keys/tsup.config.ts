import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  minify: false,
  sourcemap: true,
  shims: true,
});
