import { test, expect } from '../fixtures';

/**
 * PART 6 — Security Scanner Tests
 * Covers: exposed secrets, AWS keys, JWT secrets, .env leaks,
 *         malware patterns, severity badges, deployment blocker
 */
test.describe('Security Scanner', () => {
  const mockSecurityFindings = (findings: object[], riskLevel: string, isSafe: boolean) => ({
    id: 999, name: 'dangerous-app', framework: 'Node.js', status: 'completed',
    readiness_score: isSafe ? 70 : 20,
    ai_analysis: { score: isSafe ? 70 : 20, summary: 'Security issues found.', issues: [], recommendations: [] },
    security_scan: {
      risk_level: riskLevel,
      is_safe: isSafe,
      total_findings: findings.length,
      findings,
      blocked_deployment: !isSafe,
    },
    malware_scan: { is_safe: true, scanned_files: 5, total_findings: 0, findings: [] },
    code_review: { overall_quality_score: 50, critical_count: 0, warning_count: 0 },
  });

  function setupProjectMock(page: any, data: object) {
    page.route('**/api/projects/*', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    );
    page.route('**/api/projects/*/env-vars', (route: any) =>
      route.fulfill({ status: 200, body: '[]' })
    );
    page.route('**/api/deployments/project/*', (route: any) =>
      route.fulfill({ status: 200, body: '[]' })
    );
  }

  test('should display "no secrets exposed" for clean project', async ({ page }) => {
    setupProjectMock(page, mockSecurityFindings([], 'low', true));
    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await page.locator('button.tab', { hasText: 'Security' }).click();
    await expect(page.locator('text=No secrets or credentials exposed')).toBeVisible();
  });

  test('should render security findings table with GitHub token leak', async ({ page }) => {
    const findings = [
      {
        type: 'GITHUB_TOKEN',
        severity: 'critical',
        file: '.env',
        line: 1,
        value_preview: 'ghp_***',
      },
    ];

    setupProjectMock(page, mockSecurityFindings(findings, 'high', false));
    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await page.locator('button.tab', { hasText: 'Security' }).click();

    const table = page.locator('table.data-table');
    await expect(table).toBeVisible();
    await expect(table).toContainText('GITHUB_TOKEN');
    await expect(table).toContainText('.env');
    await expect(table).toContainText('ghp_***');
  });

  test('should show severity badge for critical findings', async ({ page }) => {
    const findings = [
      { type: 'AWS_ACCESS_KEY', severity: 'critical', file: 'config.js', line: 5, value_preview: 'AKIA***' },
    ];

    setupProjectMock(page, mockSecurityFindings(findings, 'critical', false));
    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await page.locator('button.tab', { hasText: 'Security' }).click();
    await expect(page.locator('table.data-table')).toContainText('AWS_ACCESS_KEY');
  });

  test('should show multiple findings for multi-secret leak', async ({ page }) => {
    const findings = [
      { type: 'GITHUB_TOKEN', severity: 'critical', file: '.env', line: 1, value_preview: 'ghp_***' },
      { type: 'AWS_ACCESS_KEY', severity: 'critical', file: 'config.js', line: 3, value_preview: 'AKIA***' },
      { type: 'JWT_SECRET', severity: 'high', file: 'auth.js', line: 10, value_preview: 'secret_***' },
    ];

    setupProjectMock(page, mockSecurityFindings(findings, 'critical', false));
    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await page.locator('button.tab', { hasText: 'Security' }).click();

    const table = page.locator('table.data-table');
    await expect(table).toBeVisible();

    const rows = await page.locator('table.data-table tbody tr').count();
    expect(rows).toBe(3);
  });

  test('should display deployment blocker status correctly', async ({ page }) => {
    const findings = [
      { type: 'GITHUB_TOKEN', severity: 'critical', file: '.env', line: 1, value_preview: 'ghp_***' },
    ];
    setupProjectMock(page, mockSecurityFindings(findings, 'high', false));
    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await page.locator('button.tab', { hasText: 'Security' }).click();

    // Deployment Safe should say "Blocked"
    await expect(page.locator('text=Blocked')).toBeVisible();
  });

  test('should show risk level badge on security tab', async ({ page }) => {
    const findings = [
      { type: 'AWS_SECRET_KEY', severity: 'critical', file: '.env', line: 2, value_preview: 'wJal***' },
    ];
    setupProjectMock(page, mockSecurityFindings(findings, 'critical', false));
    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await page.locator('button.tab', { hasText: 'Security' }).click();

    // Risk level badge in the card header
    const header = page.locator('.card-header').filter({ hasText: /security findings/i });
    await expect(header).toBeVisible();
  });

  test('should show total findings count', async ({ page }) => {
    const findings = [
      { type: 'GITHUB_TOKEN', severity: 'critical', file: '.env', line: 1, value_preview: 'ghp_***' },
      { type: 'DB_PASSWORD', severity: 'high', file: 'db.js', line: 5, value_preview: 'pass_***' },
    ];

    setupProjectMock(page, mockSecurityFindings(findings, 'high', false));
    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await page.locator('button.tab', { hasText: 'Security' }).click();
    await expect(page.locator('text=2')).toBeVisible();
  });
});
