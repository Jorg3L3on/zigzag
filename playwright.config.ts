import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const devBaseUrl = 'http://127.0.0.1:3069';
const prodBaseUrl = 'http://127.0.0.1:3070';
// Turbopack dev 404s on /tickets* (api/tickets + app/tickets); prod and webpack dev work.
const useProdServer = process.env.PLAYWRIGHT_USE_DEV !== '1';

const mobileSpecPattern = /(?:^|\/)mobile-.*\.spec\.ts$|(?:^|\/)tickets-mobile\.spec\.ts$/;
const visualSpecPattern = /(?:^|\/)tickets-visual\.spec\.ts$/;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.03,
    },
  },
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ??
      (useProdServer ? prodBaseUrl : devBaseUrl),
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts$/,
      testIgnore: [mobileSpecPattern, visualSpecPattern],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: mobileSpecPattern,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'visual',
      testMatch: visualSpecPattern,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useProdServer
    ? {
        command: 'npm run build && npm run start -- -p 3070',
        url: prodBaseUrl,
        reuseExistingServer: false,
        timeout: 300_000,
        env: {
          ...process.env,
          PORT: '3070',
          NEXTAUTH_URL: prodBaseUrl,
          AUTH_TRUST_HOST: 'true',
          // Keep E2E isolated from PWA shell caching across tests/sessions.
          NEXT_PUBLIC_DISABLE_SERVICE_WORKER: '1',
        },
      }
    : {
        command: 'npm run dev',
        url: devBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          NEXTAUTH_URL: devBaseUrl,
          AUTH_TRUST_HOST: 'true',
          NEXT_PUBLIC_DISABLE_SERVICE_WORKER: '1',
        },
      },
});
