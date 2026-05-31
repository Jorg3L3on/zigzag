import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const prodBaseUrl = 'http://127.0.0.1:3070';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ??
      (process.env.PLAYWRIGHT_USE_PROD ? prodBaseUrl : 'http://127.0.0.1:3069'),
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_USE_PROD
    ? {
        command: 'npm run start -- -p 3070',
        url: prodBaseUrl,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          ...process.env,
          PORT: '3070',
          NEXTAUTH_URL: prodBaseUrl,
        },
      }
    : {
        command: 'npm run dev',
        url: 'http://127.0.0.1:3069',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
