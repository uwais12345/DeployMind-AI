import { test, expect } from '../fixtures';

/**
 * PART 15 — Visual Regression Tests
 * Captures screenshots of key pages to detect layout regressions.
 * Run with: npx playwright test visual/ --update-snapshots (first run)
 */
test.describe('Visual Regression', () => {
  test.describe('Login & Register', () => {
    test('login page should match visual snapshot', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500); // Animation settle

      await expect(page).toHaveScreenshot('login-page.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('register page should match visual snapshot', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('register-page.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/projects/**', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      );
      await page.route('**/api/deployments/', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      );
      await page.route('**/api/analytics/**', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            total_projects: 12, total_deployments: 48, success_rate: 87,
            trends: [], frameworks: [], providers: [], failures: [],
          }),
        })
      );
    });

    test('dashboard should match visual snapshot', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      await expect(page).toHaveScreenshot('dashboard-page.png', {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    });
  });

  test.describe('Upload Page', () => {
    test('upload page empty state should match snapshot', async ({ page }) => {
      await page.goto('/upload');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('upload-empty.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  test.describe('AI Analysis Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/projects/999', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id: 999, name: 'visual-test-app', framework: 'React', status: 'completed',
            readiness_score: 88,
            ai_analysis: {
              score: 88, summary: 'Your project is well-structured and deployment-ready.',
              issues: ['Missing .env.example', 'No CI/CD pipeline configured'],
              recommendations: ['Add error boundaries', 'Configure Husky for pre-commit hooks'],
              checks: { has_package_json: true, has_build_script: true, has_start_script: true },
            },
            security_scan: { risk_level: 'low', is_safe: true, total_findings: 0, findings: [] },
            malware_scan: { is_safe: true, scanned_files: 24, total_findings: 0, findings: [] },
            code_review: { overall_quality_score: 85, critical_count: 0, warning_count: 3, info_count: 5 },
          }),
        })
      );
      await page.route('**/api/projects/999/env-vars', route =>
        route.fulfill({ status: 200, body: '[]' })
      );
      await page.route('**/api/deployments/project/999', route =>
        route.fulfill({ status: 200, body: '[]' })
      );
    });

    test('AI analysis page should match visual snapshot', async ({ page }) => {
      await page.goto('/analysis/999');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      await expect(page).toHaveScreenshot('analysis-page.png', {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    });

    test('Security tab should match visual snapshot', async ({ page }) => {
      await page.goto('/analysis/999');
      await page.waitForLoadState('networkidle');

      await page.locator('button.tab', { hasText: 'Security' }).click();
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot('analysis-security-tab.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  test.describe('Deployment Monitor', () => {
    test('deployment monitor (active) should match snapshot', async ({ page }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id: 42, status: 'building', provider: 'vercel', deploy_mode: 'production',
            branch: 'main', logs: [
              { id: 1, message: 'Installing dependencies...', level: 'info', stage: 'building', created_at: new Date().toISOString() },
              { id: 2, message: 'Running npm run build', level: 'info', stage: 'building', created_at: new Date().toISOString() },
            ],
          }),
        })
      );

      await page.goto('/deployments/42');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('deployment-monitor-active.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test('deployment monitor (completed) should match snapshot', async ({ page }) => {
      await page.route('**/api/deployments/42', route =>
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            id: 42, status: 'completed', provider: 'vercel', deploy_mode: 'production',
            branch: 'main', deployment_url: 'https://test-app.vercel.app',
            build_duration_seconds: 63,
            logs: [
              { id: 1, message: 'Build completed successfully', level: 'success', stage: 'deploying', created_at: new Date().toISOString() },
            ],
          }),
        })
      );

      await page.goto('/deployments/42');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('deployment-monitor-completed.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });
});
