import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom lacks TextEncoder/TextDecoder, which some Node libraries (e.g. `pg`)
// reference at import time. Polyfill them so modules that import the DB client
// can load in tests (the pool is lazy and never connects).
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '';
  },
}));

// next-intl and posthog ship ESM that Jest does not transform. Mock them so
// modules that import them (e.g. the root layout, Providers) can load in tests.
jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }) => children,
  useTranslations: () => (key) => key,
  useFormatter: () => ({}),
  useLocale: () => 'es',
  useMessages: () => ({}),
}));

jest.mock('next-intl/server', () => ({
  getLocale: async () => 'es',
  getMessages: async () => ({}),
  getTranslations: async () => (key) => key,
}));

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { init: jest.fn(), capture: jest.fn(), identify: jest.fn() },
}));

jest.mock('posthog-js/react', () => ({
  PostHogProvider: ({ children }) => children,
  usePostHog: () => null,
}));

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession() {
    return {
      data: null,
      status: 'unauthenticated',
    };
  },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
// Dummy DB URL so modules importing the Drizzle client load without throwing.
// The `pg` Pool is lazy and never connects unless a query actually runs, so
// pure-logic tests stay offline. Tests that hit the DB mock `@/lib/db`.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/zigzag_test';
