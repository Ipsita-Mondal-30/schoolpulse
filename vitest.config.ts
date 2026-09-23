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
      'tests/daily-pulse.test.ts',
      'tests/school-day.test.ts',
      'tests/notice-library-link.test.ts',
      'tests/updates-unread.test.ts',
      'tests/updates-feed.test.ts',
      'tests/this-week.test.ts',
      'tests/homework-dates.test.ts',
      'tests/deadlines/extract.test.ts',
      'tests/neverskip/deadline-from-details.test.ts',
      'tests/neverskip/changes.test.ts',
      'tests/acknowledgements.test.ts',
      'tests/parent-onboarding.test.ts',
      'tests/recap/**/*.test.ts',
      'tests/ai/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
