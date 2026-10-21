import { defineConfig, devices } from '@playwright/test';

// Locally, set PW_CHROMIUM=/usr/bin/chromium to use the system browser instead of
// downloading one. CI installs Playwright's Chromium.
const executablePath = process.env.PW_CHROMIUM;
// PW_BROWSER=firefox|webkit (CI, on main). A phone-sized viewport for each;
// Playwright's Firefox has no mobile emulation, so it gets the viewport only.
const browser = (process.env.PW_BROWSER ?? 'chromium') as 'chromium' | 'firefox' | 'webkit';
const device =
  browser === 'firefox'
    ? { ...devices['Desktop Firefox'], viewport: { width: 412, height: 839 } }
    : browser === 'webkit'
      ? devices['iPhone 14']
      : devices['Pixel 7'];

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 2,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...device,
    browserName: browser,
    trace: 'retain-on-failure',
    ...(executablePath && browser === 'chromium' ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: 'node scripts/serve.ts',
    url: 'http://127.0.0.1:4321/',
    reuseExistingServer: !process.env.CI,
  },
});
