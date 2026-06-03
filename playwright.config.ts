import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 1,
  reporter: 'html',
  projects: [
    {
      name: 'e2e',
      testIgnore: ['**/api/**'],
      use: {
        baseURL: 'https://www.saucedemo.com',
        headless: !!process.env.CI,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'on-first-retry',
      },
    },
    {
      name: 'api',
      testMatch: ['**/api/**'],
      timeout: 60_000, // restful-booker runs on Heroku free tier — cold starts can be slow
      use: {
        baseURL: 'https://restful-booker.herokuapp.com',
        trace: 'on-first-retry',
      },
    },
  ],
});
