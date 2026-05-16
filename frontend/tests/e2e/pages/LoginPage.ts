import { type Page, type Locator, expect } from '@playwright/test';

/**
 * LoginPage — Page Object Model for /login
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly googleOAuthButton: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[style*="danger"]').first();
    this.googleOAuthButton = page.locator('button', { hasText: /continue with google/i });
    this.registerLink = page.locator('a[href="/register"]');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAndWaitForDashboard(email: string, password: string) {
    await this.login(email, password);
    await this.page.waitForURL('/dashboard', { timeout: 20_000 });
  }

  async expectError(text?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (text) await expect(this.errorMessage).toContainText(text);
  }
}
