import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 builds one self-contained HTML file (used for shareable playable builds).
export default defineConfig({
  plugins: process.env.SINGLE ? [viteSingleFile()] : [],
  worker: { format: 'es' },
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120000 },
} as any);
