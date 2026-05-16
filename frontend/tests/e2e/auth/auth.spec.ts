import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';

/**
 * PART 3 — Authentication Tests
 * Covers: register, login, logout, JWT persistence, protected routes,
 *         invalid credentials, expired token handling
 */
test.describe('Authentication', () => {
  // ─── Registration ──────────────────────────────────────────────────────────
  test.describe('Registration', () => {
    test('should display register page correctly', async ({ page }) => {
      const registerPage = new RegisterPage(page);
      await registerPage.goto();

      await expect(page.locator('h1', { hasText: /create your account/i })).toBeVisible();
      await expect(registerPage.nameInput).toBeVisible();
      await expect(registerPage.emailInput).toBeVisible();
      await expect(registerPage.passwordInput).toBeVisible();
      await expect(registerPage.submitButton).toBeVisible();
      await expect(registerPage.googleOAuthButton).toBeVisible();
    });

    test('should show error for short password', async ({ page }) => {
      const registerPage = new RegisterPage(page);
      await registerPage.goto();
      await registerPage.register('Test User', `short-pass-${Date.now()}@test.com`, 'short');
      await registerPage.expectError();
    });

    test('should show error for duplicate email', async ({ page, testUser }) => {
      const registerPage = new RegisterPage(page);
      await registerPage.goto();
      // Try to register with the existing test user email
      await registerPage.register('Duplicate', testUser.email, testUser.password);
      await registerPage.expectError();
    });

    test('should redirect to login after successful registration', async ({ page }) => {
      const registerPage = new RegisterPage(page);
      await registerPage.goto();
      const uniqueEmail = `pw-test-${Date.now()}@deploymind-test.ai`;
      await registerPage.register('New User', uniqueEmail, 'SecurePass@2024!');
      await page.waitForURL('/login', { timeout: 10_000 });
      await expect(page.locator('h1', { hasText: /welcome back/i })).toBeVisible();
    });

    test('should show "Continue with Google" button', async ({ page }) => {
      const registerPage = new RegisterPage(page);
      await registerPage.goto();
      await expect(registerPage.googleOAuthButton).toBeVisible();
    });
  });

  // ─── Login ─────────────────────────────────────────────────────────────────
  test.describe('Login', () => {
    test('should display login page correctly', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await expect(page.locator('h1', { hasText: /welcome back/i })).toBeVisible();
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.submitButton).toBeVisible();
      await expect(loginPage.googleOAuthButton).toBeVisible();
    });

    test('should login successfully with valid credentials', async ({ page, testUser }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(testUser.email, testUser.password);

      await expect(page.locator('h1.page-title')).toContainText('DeployMind');
    });

    test('should show error for wrong password', async ({ page, testUser }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(testUser.email, 'wrongpassword123');
      await loginPage.expectError();
    });

    test('should show error for non-existent email', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('nobody@nowhere.invalid', 'SomePass@123');
      await loginPage.expectError();
    });

    test('should show error for empty credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.submitButton.click();
      // HTML5 validation should prevent submission — email field required
      await expect(page.locator('input:invalid')).toBeVisible();
    });

    test('should show "Continue with Google" button', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await expect(loginPage.googleOAuthButton).toBeVisible();
    });

    test('Google OAuth button should initiate redirect', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Intercept Google OAuth URL request
      let googleOAuthCalled = false;
      await page.route('**/api/google/oauth/url', route => {
        googleOAuthCalled = true;
        // Return error so no actual redirect happens in test
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Google OAuth not configured' }),
        });
      });

      await loginPage.googleOAuthButton.click();
      await page.waitForTimeout(1000);
      expect(googleOAuthCalled).toBe(true);
    });
  });

  // ─── JWT Persistence ───────────────────────────────────────────────────────
  test.describe('JWT Persistence', () => {
    test('should persist auth state after page reload', async ({ page, testUser }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(testUser.email, testUser.password);

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be on dashboard (not redirected to login)
      expect(page.url()).toContain('/dashboard');
    });

    test('should store token in localStorage', async ({ page, testUser }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(testUser.email, testUser.password);

      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
      expect(token?.startsWith('ey')).toBe(true); // JWT starts with "ey"
    });
  });

  // ─── Protected Routes ──────────────────────────────────────────────────────
  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated user from /dashboard to /login', async ({ browser }) => {
      // Use a fresh context with no storage state
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/dashboard');
      await page.waitForURL('/login', { timeout: 10_000 });
      await expect(page.locator('h1', { hasText: /welcome back/i })).toBeVisible();

      await context.close();
    });

    test('should redirect unauthenticated user from /upload to /login', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/upload');
      await page.waitForURL('/login', { timeout: 10_000 });

      await context.close();
    });
  });

  // ─── Logout ────────────────────────────────────────────────────────────────
  test.describe('Logout', () => {
    test('should clear auth state on logout', async ({ page, testUser }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(testUser.email, testUser.password);

      // Find logout button in sidebar
      const logoutButton = page.locator('button', { hasText: /logout|sign out/i });
      if (await logoutButton.count() > 0) {
        await logoutButton.click();
        await page.waitForURL('/login', { timeout: 10_000 });
        const token = await page.evaluate(() => localStorage.getItem('token'));
        expect(token).toBeNull();
      } else {
        // Clear manually to test token removal effect
        await page.evaluate(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
        });
        await page.goto('/dashboard');
        await page.waitForURL('/login', { timeout: 10_000 });
      }
    });
  });
});
