import { test, expect } from '../fixtures';

/**
 * PART 7 — Deployment Orchestration Tests
 * Covers: trigger deployment, provider selection, deployment timeline,
 *         stage transitions, cancellation, retry, rollback
 */
test.describe('Deployment Orchestration', () => {
  // ─── Deployment Monitor Page ─────────────────────────────────────────────
  test.describe('Deployment Monitor', () => {
    const mockDeployment = (status: string, extra: object = {}) => ({
      id: 42,
      project_id: 1,
      project_name: 'react-test-app',
      status,
      provider: 'vercel',
      deploy_mode: 'production',
      branch: 'main',
      build_duration_seconds: null,
      deployment_url: null,
      error_message: null,
      logs: [],
      created_at: new Date().toISOString(),
      ...extra,
    });

    function setupMonitorMock(page: any, deployment: object) {
      page.route('**/api/deployments/42', (route: any) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(deployment) })
      );
    }

    test('should render deployment monitor page', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('queued'));
      await monitorPage.goto(42);

      await expect(monitorPage.pageTitle).toBeVisible();
      await expect(monitorPage.pipelineSteps).toBeVisible();
      await expect(monitorPage.terminalPanel).toBeVisible();
    });

    test('should show Cancel button for active deployment', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('building'));
      await monitorPage.goto(42);
      await expect(monitorPage.cancelButton).toBeVisible();
    });

    test('should NOT show Cancel button for completed deployment', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('completed', {
        deployment_url: 'https://test.vercel.app',
        build_duration_seconds: 45,
      }));
      await monitorPage.goto(42);
      await expect(monitorPage.cancelButton).not.toBeVisible();
    });

    test('should show Retry button for failed deployment', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('failed', {
        error_message: 'Build failed: npm install exited with code 1',
      }));
      await monitorPage.goto(42);
      await expect(monitorPage.retryButton).toBeVisible();
    });

    test('should show Rollback button for completed deployment', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('completed', {
        deployment_url: 'https://test.vercel.app',
        build_duration_seconds: 30,
      }));
      await monitorPage.goto(42);
      await expect(monitorPage.rollbackButton).toBeVisible();
    });

    test('should show live indicator for active deployment', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('building'));
      await monitorPage.goto(42);
      await expect(monitorPage.liveIndicator).toBeVisible();
    });

    test('should show deployment URL link when completed', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('completed', {
        deployment_url: 'https://my-app.vercel.app',
      }));
      await monitorPage.goto(42);
      await expect(monitorPage.openUrlButton).toBeVisible();
    });

    test('should show error message for failed deployment', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('failed', {
        error_message: 'npm install failed: ENOENT package.json',
      }));
      await monitorPage.goto(42);

      await expect(page.locator('.error-card, [class*="error"]').first()).toBeVisible();
    });

    test('should render pipeline steps component', async ({ page, monitorPage }) => {
      setupMonitorMock(page, mockDeployment('building'));
      await monitorPage.goto(42);

      await expect(page.locator('.deploy-steps')).toBeVisible();
      await expect(page.locator('.deploy-step')).toHaveCount({ min: 1 } as any);
    });

    test('should show "Deployment not found" for invalid ID', async ({ page }) => {
      await page.route('**/api/deployments/99999', route =>
        route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not found"}' })
      );

      await page.goto('/deployments/99999');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Deployment not found')).toBeVisible();
    });
  });

  // ─── Log Filtering ─────────────────────────────────────────────────────────
  test.describe('Log Filtering', () => {
    const mockDeploymentWithLogs = {
      id: 42,
      project_id: 1,
      status: 'completed',
      provider: 'vercel',
      deploy_mode: 'production',
      branch: 'main',
      logs: [
        { id: 1, message: 'Build started', level: 'info', stage: 'building', created_at: new Date().toISOString() },
        { id: 2, message: 'npm install completed', level: 'success', stage: 'building', created_at: new Date().toISOString() },
        { id: 3, message: 'Build warning: unused variable', level: 'warning', stage: 'building', created_at: new Date().toISOString() },
        { id: 4, message: 'Build error: syntax error', level: 'error', stage: 'building', created_at: new Date().toISOString() },
      ],
      deployment_url: 'https://test.vercel.app',
      build_duration_seconds: 45,
    };

    test('should render terminal with deployment logs', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDeploymentWithLogs) })
      );

      await monitorPage.goto(42);
      await expect(monitorPage.terminalPanel).toBeVisible();
      await expect(page.locator('.log-line').first()).toBeVisible();
    });

    test('should filter logs by error level', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDeploymentWithLogs) })
      );

      await monitorPage.goto(42);
      await monitorPage.filterLogs('error');

      const logLines = await page.locator('.log-line').count();
      const errorLines = await page.locator('.log-error').count();
      expect(logLines).toEqual(errorLines);
    });

    test('should search logs by term', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDeploymentWithLogs) })
      );

      await monitorPage.goto(42);
      await monitorPage.searchLogs('npm install');

      await expect(page.locator('text=npm install completed')).toBeVisible();
    });

    test('should show search input in terminal header', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDeploymentWithLogs) })
      );

      await monitorPage.goto(42);
      await expect(monitorPage.searchInput).toBeVisible();
    });
  });

  // ─── Deployment Actions ────────────────────────────────────────────────────
  test.describe('Deployment Actions', () => {
    test('should trigger API call on Retry click', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 42, status: 'failed', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );

      let retryApiCalled = false;
      await page.route('**/api/deployments/42/retry', route => {
        retryApiCalled = true;
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ deployment_id: 43 }),
        });
      });

      await monitorPage.goto(42);
      await monitorPage.retryButton.click();
      expect(retryApiCalled).toBe(true);
    });

    test('should trigger API call on Cancel click', async ({ page, monitorPage }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 42, status: 'building', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );

      let cancelApiCalled = false;
      await page.route('**/api/deployments/42/cancel', route => {
        cancelApiCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"message":"Cancelled"}' });
      });
      // Re-fetch after cancel
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: 42, status: 'cancelled', provider: 'vercel', deploy_mode: 'production', branch: 'main', logs: [] }),
        })
      );

      await monitorPage.goto(42);
      await monitorPage.cancelButton.click();
      await page.waitForTimeout(500);
      expect(cancelApiCalled).toBe(true);
    });
  });
});
