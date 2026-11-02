import { defineConfig, devices } from '@playwright/test';
import { getBaseUrl } from './src/config/env.js';
import { AUTH_STORAGE_STATE } from './src/config/paths.js';

const isCI = Boolean(process.env.CI);

/** Opening the app can spend two minutes riding out startup reloads before a test body runs. */
const TEST_TIMEOUT_MS = 3 * 60_000;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [[isCI ? 'github' : 'list'], ['html', { open: 'never' }]],
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: 10_000 },

  use: {
    baseURL: getBaseUrl(),
    // Runs headed: the Flutter canvas and its startup reloads need to be watchable.
    // A headless CI runner would need xvfb, or this flag flipped for CI.
    headless: false,
    // Blocking the service worker often removes the app's self-reload entirely.
    serviceWorkers: 'block',
    // Text locators are the app's own copy, so the UI language has to be pinned.
    locale: 'en-US',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testDir: './tests/setup',
      // `*.setup.ts` is outside Playwright's default spec pattern.
      testMatch: '**/*.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Tests that need the login UI itself, so they must start signed out.
      name: 'anonymous',
      testDir: './tests/anonymous',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Everything else reuses one sign-in and skips the login screen.
      name: 'authenticated',
      testDir: './tests/authenticated',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STORAGE_STATE },
    },
  ],
});
