import { defineConfig } from 'vitest/config';
// one-off searches and reports under scripts/ (not part of `npm test`)
export default defineConfig({ test: { include: ['scripts/**/*.test.ts'], testTimeout: 3600000 } });
