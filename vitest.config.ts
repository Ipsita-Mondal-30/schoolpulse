import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/neverskip/**/*.test.ts',
      'tests/ui-merge.test.ts',
      'tests/ui-query-cache.test.ts',
      'tests/daily-brief.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
