import { defineConfig, devices } from '@playwright/test';

// Locally, set PW_CHROMIUM=/usr/bin/chromium to use the system browser instead of
// downloading one. CI installs Playwright's Chromium.
const executablePath = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 2,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: 'node scripts/serve.ts',
    url: 'http://127.0.0.1:4321/',
    reuseExistingServer: !process.env.CI,
  },
});
