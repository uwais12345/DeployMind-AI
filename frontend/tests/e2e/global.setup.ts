import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Global Setup — Authenticates once and saves session state for all tests.
 * This avoids re-logging in for every test suite.
 */
setup('authenticate as test user', async ({ page, request }) => {
  const email = process.env.TEST_USER_EMAIL ?? 'playwright.test@deploymind.ai';
  const password = process.env.TEST_USER_PASSWORD ?? 'Playwright@123!';
  const name = process.env.TEST_USER_NAME ?? 'Playwright Tester';

  // Ensure .auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // ─── Step 1: Try to register the test user (idempotent) ──────────────────
  const registerRes = await request.post('/api/users/register', {
    data: { email, password, full_name: name },
  });
  // 201 = created, 400 = already registered — both are acceptable
  const registrationOk = registerRes.status() === 201 || registerRes.status() === 400;
  if (!registrationOk) {
    throw new Error(`Test user registration failed: ${registerRes.status()} ${await registerRes.text()}`);
  }

  // ─── Step 2: Navigate to login and sign in ──────────────────────────────
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // ─── Step 3: Wait until we reach dashboard ──────────────────────────────
  await page.waitForURL('/dashboard', { timeout: 20_000 });
  await expect(page.locator('h1')).toContainText('DeployMind');

  // ─── Step 4: Persist browser storage state ──────────────────────────────
  await page.context().storageState({ path: authFile });

  console.log('[Setup] ✓ Authentication state saved to', authFile);
});
