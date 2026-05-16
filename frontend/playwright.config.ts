import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, 'tests/e2e/.env.test') });

/**
 * DeployMind AI — Enterprise Playwright E2E Configuration
 * Supports: Chromium, Firefox, WebKit
 * Features: Multi-browser, traces, videos, screenshots, CI-ready retries
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
    ...(process.env.CI ? [['github'] as [string]] : []),
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    headless: process.env.CI ? true : false,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Always capture console errors
    extraHTTPHeaders: {
      'x-test-run': 'playwright-e2e',
    },
  },

  projects: [
    // ─── SETUP: Global Auth State ────────────────────────────────────────────
    {
      name: 'setup',
      testMatch: '**/global.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // ─── CHROMIUM ─────────────────────────────────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ─── FIREFOX ──────────────────────────────────────────────────────────────
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ─── WEBKIT (Safari) ──────────────────────────────────────────────────────
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // ─── MOBILE Chrome ─────────────────────────────────────────────────────── 
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: '**/responsive/**/*.spec.ts',
    },

    // ─── NO-AUTH (Login, Register) ──────────────────────────────────────────
    {
      name: 'no-auth',
      testMatch: '**/auth/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
