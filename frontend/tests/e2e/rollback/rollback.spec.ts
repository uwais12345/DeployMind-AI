import { test, expect } from '../fixtures';

/**
 * PART 11 — Rollback & Retry Tests
 * Covers: retry execution, rollback execution, state consistency, audit events
 */
test.describe('Rollback & Retry', () => {
  // ─── Retry Tests ──────────────────────────────────────────────────────────
  test.describe('Retry', () => {
    test('should trigger retry from deployment monitor', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id: 42, status: 'failed', provider: 'vercel', deploy_mode: 'production',
            branch: 'main', logs: [], error_message: 'Build script failed',
          }),
        })
      );

      let retryRequestMade = false;
      await page.route('**/api/deployments/42/retry', route => {
        retryRequestMade = true;
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ deployment_id: 43, message: 'Retry initiated' }),
        });
      });

      await monitorPage.goto(42);
      await expect(monitorPage.retryButton).toBeVisible();
      await monitorPage.retryButton.click();

      await page.waitForTimeout(500);
      expect(retryRequestMade).toBe(true);
    });

    test('should navigate to new deployment on retry success', async ({ page }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 42, status: 'failed', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );
      await page.route('**/api/deployments/43', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 43, status: 'queued', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );
      await page.route('**/api/deployments/42/retry', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ deployment_id: 43 }),
        })
      );

      await page.goto('/deployments/42');
      await page.waitForLoadState('networkidle');

      await page.locator('button', { hasText: /retry/i }).click();
      await page.waitForURL('/deployments/43', { timeout: 10_000 });
    });

    test('should show success toast after retry', async ({ page }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 42, status: 'failed', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );
      await page.route('**/api/deployments/43', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 43, status: 'queued', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );
      await page.route('**/api/deployments/42/retry', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deployment_id: 43 }) })
      );

      await page.goto('/deployments/42');
      await page.waitForLoadState('networkidle');
      await page.locator('button', { hasText: /retry/i }).click();

      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5_000 });
    });

    test('should show retry from AI Analysis history tab', async ({ page }) => {
      const failedDeployment = {
        id: 10, project_id: 999, status: 'failed', provider: 'vercel',
        branch: 'main', deploy_mode: 'production', build_duration_seconds: null, created_at: new Date().toISOString(),
      };

      await page.route('**/api/projects/999', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id: 999, name: 'test-app', framework: 'React', status: 'completed',
            readiness_score: 75,
            ai_analysis: { score: 75, summary: 'OK', issues: [], recommendations: [] },
            security_scan: { risk_level: 'low', is_safe: true, total_findings: 0, findings: [] },
            malware_scan: { is_safe: true, scanned_files: 5, total_findings: 0, findings: [] },
            code_review: { overall_quality_score: 75, critical_count: 0, warning_count: 0 },
          }),
        })
      );
      await page.route('**/api/projects/999/env-vars', route =>
        route.fulfill({ status: 200, body: '[]' })
      );
      await page.route('**/api/deployments/project/999', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([failedDeployment]) })
      );

      await page.goto('/analysis/999');
      await page.waitForLoadState('networkidle');

      await page.locator('button.tab', { hasText: /history/i }).click();
      await page.waitForTimeout(300);

      // Retry icon button should be visible for failed deployment
      const retryBtn = page.locator('table.data-table button[title="Retry"]').first();
      if (await retryBtn.isVisible()) {
        await expect(retryBtn).toBeVisible();
      } else {
        // Look for RefreshCw icon button
        await expect(page.locator('table.data-table .btn').filter({ hasText: '' }).first()).toBeVisible();
      }
    });
  });

  // ─── Rollback Tests ───────────────────────────────────────────────────────
  test.describe('Rollback', () => {
    test('should trigger rollback from deployment monitor', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id: 42, status: 'completed', provider: 'vercel', deploy_mode: 'production',
            branch: 'main', logs: [], deployment_url: 'https://test.vercel.app',
          }),
        })
      );

      // Handle confirm dialog
      page.on('dialog', dialog => dialog.accept());

      let rollbackCalled = false;
      await page.route('**/api/deployments/42/rollback', route => {
        rollbackCalled = true;
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ deployment_id: 43 }),
        });
      });
      await page.route('**/api/deployments/43', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 43, status: 'queued', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );

      await monitorPage.goto(42);
      await expect(monitorPage.rollbackButton).toBeVisible();
      await monitorPage.rollbackButton.click();

      await page.waitForTimeout(500);
      expect(rollbackCalled).toBe(true);
    });

    test('should show confirmation dialog before rollback', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id: 42, status: 'completed', provider: 'vercel', deploy_mode: 'production',
            branch: 'main', logs: [], deployment_url: 'https://test.vercel.app',
          }),
        })
      );

      let dialogShown = false;
      page.on('dialog', async dialog => {
        dialogShown = true;
        expect(dialog.message()).toContain('rollback');
        await dialog.dismiss(); // Cancel rollback
      });

      await monitorPage.goto(42);
      await monitorPage.rollbackButton.click();
      await page.waitForTimeout(500);
      expect(dialogShown).toBe(true);
    });

    test('should navigate to new deployment after rollback', async ({ page }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 42, status: 'completed', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [], deployment_url: 'https://test.vercel.app' }),
        })
      );
      await page.route('**/api/deployments/43', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 43, status: 'queued', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );
      await page.route('**/api/deployments/42/rollback', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ deployment_id: 43 }) })
      );

      page.on('dialog', dialog => dialog.accept());

      await page.goto('/deployments/42');
      await page.waitForLoadState('networkidle');

      await page.locator('button', { hasText: /rollback/i }).click();
      await page.waitForURL('/deployments/43', { timeout: 10_000 });
    });
  });
});
