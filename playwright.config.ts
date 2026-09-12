import { defineConfig, devices } from '@playwright/test';
const port = process.env.PILIRUN_TEST_PORT ?? '3000';
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'android',
      grep: /mobile|portrait/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iphone',
      grep: /mobile|portrait/,
      use: { ...devices['iPhone 15'] },
    },
  ],
  webServer: {
    command: `npm start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
