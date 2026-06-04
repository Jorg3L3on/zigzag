import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const devBaseUrl = 'http://127.0.0.1:3069';
const prodBaseUrl = 'http://127.0.0.1:3070';
const useProdServer = Boolean(process.env.PLAYWRIGHT_USE_PROD || process.env.CI);

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ??
      (useProdServer ? prodBaseUrl : devBaseUrl),
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
        },
      },
});
