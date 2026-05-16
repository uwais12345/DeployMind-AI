import { type Page, type Locator, expect } from '@playwright/test';

/**
 * AIAnalysisPage — Page Object Model for /analysis/:id
 */
export class AIAnalysisPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly scoreGauge: Locator;
  readonly deployButton: Locator;
  readonly tabBar: Locator;
  readonly analysisTab: Locator;
  readonly securityTab: Locator;
  readonly environmentTab: Locator;
  readonly historyTab: Locator;
  readonly codeReviewTab: Locator;
  readonly fixTab: Locator;
  readonly issuesList: Locator;
  readonly recommendationsList: Locator;
  readonly securityFindingsTable: Locator;
  readonly envVarForm: Locator;
  readonly envVarTable: Locator;
  readonly fixButton: Locator;
  readonly fixResults: Locator;
  readonly processingOverlay: Locator;
  readonly skeletonLoaders: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1', { hasText: /ai analysis/i });
    this.scoreGauge = page.locator('.score-gauge');
    this.deployButton = page.locator('button', { hasText: /deploy now/i });
    this.tabBar = page.locator('.tabs');
    this.analysisTab = page.locator('button.tab', { hasText: /ai analysis/i });
    this.securityTab = page.locator('button.tab', { hasText: /security/i });
    this.environmentTab = page.locator('button.tab', { hasText: /environment/i });
    this.historyTab = page.locator('button.tab', { hasText: /history/i });
    this.codeReviewTab = page.locator('button.tab', { hasText: /code review/i });
    this.fixTab = page.locator('button.tab', { hasText: /fix my project/i });
    this.issuesList = page.locator('.card', { hasText: /issues detected/i });
    this.recommendationsList = page.locator('.card', { hasText: /recommendations/i });
    this.securityFindingsTable = page.locator('table.data-table');
    this.envVarForm = page.locator('form');
    this.envVarTable = page.locator('table.data-table');
    this.fixButton = page.locator('button', { hasText: /scan and fix project/i });
    this.fixResults = page.locator('.diagnostics-panel');
    this.processingOverlay = page.locator('h1', { hasText: /analysis in progress/i });
    this.skeletonLoaders = page.locator('.skeleton');
  }

  async goto(projectId: number | string) {
    await this.page.goto(`/analysis/${projectId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForAnalysisComplete(timeout = 60_000) {
    // Wait for processing overlay to disappear
    await this.page.waitForFunction(
      () => !document.querySelector('h1')?.textContent?.includes('Analysis in Progress'),
      { timeout }
    );
  }

  async clickTab(tabName: 'analysis' | 'security' | 'environment' | 'history' | 'code-review' | 'fix') {
    const tabMap = {
      analysis: this.analysisTab,
      security: this.securityTab,
      environment: this.environmentTab,
      history: this.historyTab,
      'code-review': this.codeReviewTab,
      fix: this.fixTab,
    };
    await tabMap[tabName].click();
    await this.page.waitForTimeout(300); // Animation settle
  }

  async expectScoreVisible() {
    await expect(this.scoreGauge).toBeVisible();
    // Score gauge should have a number value
    const scoreText = await this.page.locator('.score-gauge-value').textContent();
    const score = parseInt(scoreText ?? '0');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  }

  async addEnvVar(key: string, value: string, isSecret = false) {
    await this.clickTab('environment');
    await this.page.locator('input[placeholder="e.g. API_KEY"]').fill(key);
    await this.page.locator('input[placeholder="Value"]').fill(value);
    if (isSecret) {
      await this.page.locator('input[type="checkbox"]').check();
    }
    await this.page.locator('button', { hasText: /add/i }).click();
  }
}
