import { AsyncLocalStorage } from 'node:async_hooks';
import nextJest from 'next/jest.js';

// Next only installs a global AsyncLocalStorage inside its own server runtime. In the
// Jest main process it falls back to a fake whose run()/disable() throw, which crashed
// the process after every suite had passed. Hand it the real one.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

// Pin timezone so date-fns calendar helpers (isYesterday, differenceInCalendarDays)
// are stable in CI across runner locales.
process.env.TZ = 'UTC';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  passWithNoTests: false,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    // Generated base64 fonts (~270 KB strings): instrumenting them takes minutes and crashes the SWC worker.
    '!src/lib/receipt-pdf/fonts/plex-*.ts',
  ],
  // Conservative floor below current coverage so it acts as a regression guard
  // (fails CI on a meaningful drop) without being brittle. Raise over time.
  // Path gate (execution-plan 2.3): RBAC contract modules must stay >90%.
  coverageThreshold: {
    global: {
      statements: 25,
      branches: 17,
      functions: 20,
      lines: 25,
    },
    './src/lib/*-rbac*.ts': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
    '<rootDir>/e2e/',
    '<rootDir>/.claude/',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
const withEsmDeps = async () => {
  const config = await createJestConfig(customJestConfig)();
  // Session token tests decode real Auth.js JWTs; those packages ship ESM only.
  // next/jest sets its own transformIgnorePatterns, so extend them here.
  // The lookahead checks the whole path: with a pnpm layout the package sits under
  // node_modules/.pnpm/<pkg>/node_modules/<pkg>, and a check on the first
  // node_modules segment ignored it, so Node loaded the ESM outside Jest and it
  // sometimes crashed with "AsyncLocalStorage accessed in runtime where it is not available".
  config.transformIgnorePatterns = [
    '^(?!.*/node_modules/(jose|@auth/core|next-auth)/).*/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ];
  return config;
};

export default withEsmDeps;
