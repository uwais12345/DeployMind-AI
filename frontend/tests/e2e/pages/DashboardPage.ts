import { type Page, type Locator, expect } from '@playwright/test';

/**
 * DashboardPage — Page Object Model for /dashboard
 */
export class DashboardPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly newProjectButton: Locator;
  readonly statsCards: Locator;
  readonly recentDeploymentsTable: Locator;
  readonly projectsList: Locator;
  readonly activityChart: Locator;
  readonly skeletonLoaders: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1.page-title');
    this.newProjectButton = page.locator('button', { hasText: /new project/i });
    this.statsCards = page.locator('.stats-card');
    this.recentDeploymentsTable = page.locator('table.data-table').first();
    this.projectsList = page.locator('.card').filter({ hasText: /projects/i }).last();
    this.activityChart = page.locator('.recharts-wrapper').first();
    this.skeletonLoaders = page.locator('.skeleton');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForDataLoad() {
    // Wait for skeletons to disappear
    await this.page.waitForFunction(() =>
      document.querySelectorAll('.skeleton').length === 0,
      { timeout: 15_000 }
    );
  }

  async expectStatsVisible() {
    await expect(this.statsCards).toHaveCount(4);
    for (const card of await this.statsCards.all()) {
      await expect(card).toBeVisible();
    }
  }

  async clickNewProject() {
    await this.newProjectButton.click();
    await this.page.waitForURL('/upload');
  }
}
