import { test, expect } from '../fixtures';
import {
  createValidReactZip,
  createProjectViaAPI,
  waitForDeploymentStatus,
} from '../utils/helpers';

/**
 * PART 5 — AI Analysis Tests
 * Covers: score rendering, recommendations, security/malware findings,
 *         fallback states, empty states, tab navigation, loading skeletons,
 *         malformed AI response handling
 */
test.describe('AI Analysis Dashboard', () => {
  let projectId: number;

  // We create a project before the suite runs. This is an integration test —
  // it requires the backend to be running.
  test.beforeAll(async ({ playwright, testUser }) => {
    const request = await playwright.request.newContext({
      baseURL: process.env.API_URL ?? 'http://localhost:8000',
    });

    // Login
    const loginRes = await request.post('/api/users/login', {
      data: { email: testUser.email, password: testUser.password },
    });
    const { access_token } = await loginRes.json();

    const zipPath = createValidReactZip();
    try {
      projectId = await createProjectViaAPI(request, access_token, zipPath);
    } catch {
      projectId = -1; // Will skip dependent tests
    }

    await request.dispose();
  });

  // ─── Page Structure ─────────────────────────────────────────────────────────
  test('should render analysis page structure for valid project', async ({ page, analysisPage }) => {
    if (projectId === -1) test.skip();

    await analysisPage.goto(projectId);

    // Either processing or completed
    const isProcessing = await page.locator('h1', { hasText: /analysis in progress/i }).isVisible().catch(() => false);
    const isComplete = await page.locator('h1', { hasText: /ai analysis report/i }).isVisible().catch(() => false);

    expect(isProcessing || isComplete).toBe(true);
  });

  test('should show processing state with spinner and status text', async ({ page, analysisPage }) => {
    // Mock a project that's still processing
    await page.route('**/api/projects/*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          name: 'test-project',
          framework: 'React',
          status: 'ai_analyzing',
          readiness_score: 0,
          ai_analysis: null,
          security_scan: null,
          malware_scan: null,
          code_review: null,
        }),
      });
    });

    await page.goto('/analysis/999');
    await expect(page.locator('h1', { hasText: /analysis in progress/i })).toBeVisible();
    await expect(page.locator('.spin')).toBeVisible();
  });

  // ─── Completed Analysis UI ─────────────────────────────────────────────────
  test('should render score gauge with valid score', async ({ page }) => {
    await page.route('**/api/projects/*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          name: 'react-app',
          framework: 'React',
          status: 'completed',
          readiness_score: 85,
          ai_analysis: {
            score: 85,
            summary: 'Project is well-structured and ready for deployment.',
            issues: ['Missing .env.example file'],
            recommendations: ['Add error boundaries', 'Enable tree shaking'],
            checks: { has_package_json: true, has_build_script: true },
          },
          security_scan: { risk_level: 'low', is_safe: true, total_findings: 0, findings: [] },
          malware_scan: { is_safe: true, scanned_files: 12, total_findings: 0, findings: [] },
          code_review: { overall_quality_score: 82, critical_count: 0, warning_count: 2 },
        }),
      });
    });

    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    // Score gauge should be visible
    await expect(page.locator('.score-gauge')).toBeVisible();
    await expect(page.locator('.score-gauge-value')).toContainText('85');
  });

  test('should render AI issues and recommendations', async ({ page }) => {
    await page.route('**/api/projects/*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999, name: 'react-app', framework: 'React', status: 'completed',
          readiness_score: 75,
          ai_analysis: {
            score: 75,
            summary: 'Moderate readiness.',
            issues: ['Missing TypeScript types', 'No test coverage'],
            recommendations: ['Add Jest tests', 'Configure Husky'],
            checks: { has_package_json: true },
          },
          security_scan: { risk_level: 'low', is_safe: true, total_findings: 0, findings: [] },
          malware_scan: { is_safe: true, scanned_files: 5, total_findings: 0, findings: [] },
          code_review: { overall_quality_score: 70, critical_count: 0, warning_count: 3 },
        }),
      });
    });

    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.card', { hasText: 'Issues Detected' })).toBeVisible();
    await expect(page.locator('text=Missing TypeScript types')).toBeVisible();
    await expect(page.locator('.card', { hasText: 'Recommendations' })).toBeVisible();
    await expect(page.locator('text=Add Jest tests')).toBeVisible();
  });

  // ─── Tab Navigation ────────────────────────────────────────────────────────
  test('should navigate through all analysis tabs', async ({ page }) => {
    await page.route('**/api/projects/*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999, name: 'react-app', framework: 'React', status: 'completed',
          readiness_score: 80, ai_analysis: { score: 80, summary: 'OK', issues: [], recommendations: [], checks: {} },
          security_scan: { risk_level: 'low', is_safe: true, total_findings: 0, findings: [] },
          malware_scan: { is_safe: true, scanned_files: 5, total_findings: 0, findings: [] },
          code_review: { overall_quality_score: 80, critical_count: 0, warning_count: 0 },
        }),
      });
    });
    await page.route('**/api/projects/*/env-vars', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/deployments/project/*', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    const tabs = ['Security', 'Environment', 'History', 'Code Review', 'Fix My Project'];
    for (const tabText of tabs) {
      const tabButton = page.locator('button.tab', { hasText: tabText });
      await tabButton.click();
      await page.waitForTimeout(400);
      await expect(tabButton).toHaveClass(/active/);
    }
  });

  // ─── Security Tab ──────────────────────────────────────────────────────────
  test('should show clean security scan result', async ({ page }) => {
    await page.route('**/api/projects/*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999, name: 'clean-app', framework: 'React', status: 'completed',
          readiness_score: 95,
          ai_analysis: { score: 95, summary: 'Excellent', issues: [], recommendations: [] },
          security_scan: { risk_level: 'low', is_safe: true, total_findings: 0, findings: [] },
          malware_scan: { is_safe: true, scanned_files: 10, total_findings: 0, findings: [] },
          code_review: { overall_quality_score: 95, critical_count: 0, warning_count: 0 },
        }),
      });
    });
    await page.route('**/api/projects/*/env-vars', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/deployments/project/*', route => route.fulfill({ status: 200, body: '[]' }));

    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await page.locator('button.tab', { hasText: 'Security' }).click();
    await expect(page.locator('text=No secrets or credentials exposed')).toBeVisible();
  });

  // ─── Fallback / Error States ───────────────────────────────────────────────
  test('should show "Project not found" for invalid project ID', async ({ page }) => {
    await page.route('**/api/projects/99999', route => {
      route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not found"}' });
    });

    await page.goto('/analysis/99999');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Project not found')).toBeVisible();
  });

  test('should not crash when ai_analysis is null (malformed response)', async ({ page }) => {
    await page.route('**/api/projects/*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999, name: 'broken-app', framework: 'Unknown', status: 'completed',
          readiness_score: 0,
          ai_analysis: null,
          security_scan: null,
          malware_scan: null,
          code_review: null,
        }),
      });
    });
    await page.route('**/api/projects/*/env-vars', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/deployments/project/*', route => route.fulfill({ status: 200, body: '[]' }));

    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    // Should not throw — fallback rendering
    await expect(page.locator('.score-gauge')).toBeVisible();
    await expect(page.locator('.score-gauge-value')).toContainText('0');

    // No unhandled errors
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('WebSocket'))).toHaveLength(0);
  });

  // ─── Deploy Button ─────────────────────────────────────────────────────────
  test('should show Deploy Now button on completed analysis', async ({ page }) => {
    await page.route('**/api/projects/*', route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 999, name: 'my-app', framework: 'React', status: 'completed',
          readiness_score: 88,
          ai_analysis: { score: 88, summary: 'Ready', issues: [], recommendations: [] },
          security_scan: { risk_level: 'low', is_safe: true, total_findings: 0, findings: [] },
          malware_scan: { is_safe: true, scanned_files: 5, total_findings: 0, findings: [] },
          code_review: { overall_quality_score: 88, critical_count: 0, warning_count: 0 },
        }),
      });
    });
    await page.route('**/api/projects/*/env-vars', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/deployments/project/*', route => route.fulfill({ status: 200, body: '[]' }));

    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button', { hasText: /deploy now/i })).toBeVisible();
  });
});
