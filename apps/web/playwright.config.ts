import { defineConfig, devices } from '@playwright/test';

// Playwright starts BOTH servers before the tests: the AgentPay API on 4000
// and the web dashboard on 5173 (which proxies /api to the API). Each test run
// therefore exercises the whole stack against freshly seeded, deterministic data.
export default defineConfig({
  testDir: './tests',
  // The suite shares one API server and resets it before each test, so tests
  // run serially. A small, reliable suite beats a fast, flaky one.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'AGENTPAY_TEST_RESET=1 npm --prefix ../api run start',
      port: 4000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
