import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from '../shared/test-data';

/**
 * The episodes are H.264 HLS. Playwright's bundled Chromium ships without
 * proprietary codecs, so playback tests run in branded Google Chrome
 * (`npx playwright install chrome`). Mobile emulation matches the main audience:
 * the product is mobile-first.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: '../artifacts/web-results',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Production target: keep the load polite.
  workers: process.env.CI ? 2 : 3,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../artifacts/web-report', open: 'never' }],
    // Read by `npm run earned` to tell a real pass from an empty one.
    ['json', { outputFile: '../artifacts/web-results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    channel: 'chrome',
    // Traces store every network response body, and here those are HLS video
    // segments: one trace of a playback test is tens of MB. Keep only the first
    // failed attempt of each test; a retry that fails the same way adds nothing.
    trace: 'retain-on-first-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
});
