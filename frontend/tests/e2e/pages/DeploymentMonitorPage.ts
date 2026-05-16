import { type Page, type Locator, expect } from '@playwright/test';

/**
 * DeploymentMonitorPage — Page Object Model for /deployments/:id
 */
export class DeploymentMonitorPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly statusBadge: Locator;
  readonly pipelineSteps: Locator;
  readonly terminalPanel: Locator;
  readonly terminalLogs: Locator;
  readonly cancelButton: Locator;
  readonly retryButton: Locator;
  readonly rollbackButton: Locator;
  readonly openUrlButton: Locator;
  readonly refreshButton: Locator;
  readonly searchInput: Locator;
  readonly logFilterButtons: Locator;
  readonly copyLogsButton: Locator;
  readonly exportLogsButton: Locator;
  readonly diagnosticsPanel: Locator;
  readonly liveIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1', { hasText: /deployment monitor/i });
    this.statusBadge = page.locator('.badge').first();
    this.pipelineSteps = page.locator('.deploy-steps');
    this.terminalPanel = page.locator('.terminal-panel');
    this.terminalLogs = page.locator('.terminal-body');
    this.cancelButton = page.locator('button', { hasText: /cancel/i });
    this.retryButton = page.locator('button', { hasText: /retry/i });
    this.rollbackButton = page.locator('button', { hasText: /rollback/i });
    this.openUrlButton = page.locator('a', { hasText: /open url/i });
    this.refreshButton = page.locator('button').filter({ has: page.locator('svg[class*="RefreshCw"]') }).last();
    this.searchInput = page.locator('input[placeholder="Search logs..."]');
    this.logFilterButtons = page.locator('button').filter({ hasText: /^(all|info|warning|error)$/i });
    this.copyLogsButton = page.locator('button[title="Copy Logs"]');
    this.exportLogsButton = page.locator('button[title="Export Logs"]');
    this.diagnosticsPanel = page.locator('.diagnostics-panel');
    this.liveIndicator = page.locator('.pulse-dot');
  }

  async goto(deploymentId: number | string) {
    await this.page.goto(`/deployments/${deploymentId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForStatus(status: string, timeout = 120_000) {
    await this.page.waitForFunction(
      (s) => document.querySelector('.badge')?.textContent?.toLowerCase().includes(s),
      status,
      { timeout }
    );
  }

  async waitForCompletion(timeout = 120_000) {
    await this.page.waitForFunction(
      () => {
        const badge = document.querySelector('.badge');
        const text = badge?.textContent?.toLowerCase() ?? '';
        return text.includes('completed') || text.includes('failed');
      },
      { timeout }
    );
  }

  async expectTerminalHasLogs() {
    await expect(this.terminalLogs).toBeVisible();
    // Terminal should contain at least one log line
    await expect(this.page.locator('.log-line').first()).toBeVisible({ timeout: 30_000 });
  }

  async filterLogs(level: 'all' | 'info' | 'warning' | 'error') {
    await this.page.locator('button').filter({ hasText: new RegExp(`^${level}$`, 'i') }).first().click();
  }

  async searchLogs(term: string) {
    await this.searchInput.fill(term);
  }
}
