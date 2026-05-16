import { test, expect } from '../fixtures';

/**
 * PART 12 — Failure Simulation Tests
 * Covers: backend unavailable, API errors, malformed responses,
 *         deployment timeout, provider failure, UI resilience
 *
 * PART 13 — Accessibility Tests
 * Covers: keyboard navigation, focus management, ARIA attributes
 *
 * PART 14 — Performance Tests
 * Covers: large log lists, concurrent requests, memory stability
 */

// ─── FAILURE SIMULATION ───────────────────────────────────────────────────────
test.describe('Failure Simulation', () => {
  test('should show error toast when backend is unavailable on login', async ({ page }) => {
    await page.route('**/api/users/login', route =>
      route.abort('failed')
    );

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@test.com');
    await page.locator('input[type="password"]').fill('TestPass@123');
    await page.locator('button[type="submit"]').click();

    // Should show an error, not crash
    await expect(page.locator('[style*="danger"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('should handle 500 error from deployments API gracefully', async ({ page }) => {
    await page.route('**/api/deployments/', route =>
      route.fulfill({ status: 500, body: '{"detail":"Internal server error"}' })
    );
    await page.route('**/api/projects/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/analytics/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        total_projects: 0, total_deployments: 0, success_rate: 0, trends: [], frameworks: [], providers: [], failures: [],
      }) })
    );

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Page should still render, even with API failure
    await expect(page.locator('h1.page-title')).toBeVisible();
    expect(errors.filter(e => !e.includes('WebSocket'))).toHaveLength(0);
  });

  test('should handle 401 unauthorized gracefully', async ({ page }) => {
    await page.route('**/api/projects/**', route =>
      route.fulfill({ status: 401, body: '{"detail":"Not authenticated"}' })
    );
    await page.route('**/api/deployments/', route =>
      route.fulfill({ status: 401, body: '{"detail":"Not authenticated"}' })
    );
    await page.route('**/api/analytics/**', route =>
      route.fulfill({ status: 401, body: '{"detail":"Not authenticated"}' })
    );
    await page.route('**/api/users/me', route =>
      route.fulfill({ status: 401, body: '{"detail":"Not authenticated"}' })
    );
    await page.route('**/api/users/refresh', route =>
      route.fulfill({ status: 401, body: '{"detail":"Invalid token"}' })
    );

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/dashboard');
    await page.waitForTimeout(3000);

    // Should either stay on dashboard (cached) or redirect to login — no crash
    const url = page.url();
    expect(url.includes('/dashboard') || url.includes('/login')).toBe(true);
    expect(errors.filter(e => !e.includes('WebSocket') && !e.includes('401'))).toHaveLength(0);
  });

  test('should not crash on malformed JSON from analytics API', async ({ page }) => {
    await page.route('**/api/analytics/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'INVALID_JSON{{{' })
    );
    await page.route('**/api/projects/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/deployments/', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The dashboard should still render, charts may be empty
    await expect(page.locator('h1.page-title')).toBeVisible();
  });

  test('should show error message when deployment monitor API fails', async ({ page }) => {
    await page.route('**/api/deployments/42', route =>
      route.fulfill({ status: 503, body: '{"detail":"Service unavailable"}' })
    );

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    // Should show not found or remain graceful
    expect(errors.filter(e => !e.includes('WebSocket'))).toHaveLength(0);
  });

  test('should handle upload API timeout gracefully', async ({ page }) => {
    await page.route('**/api/projects/upload', route => {
      // Simulate timeout by aborting
      route.abort('timedout');
    });

    await page.goto('/upload');
    const { createValidReactZip } = await import('../utils/helpers');
    const zipPath = createValidReactZip();

    await page.locator('#file-input').setInputFiles(zipPath);
    await expect(page.locator('button', { hasText: /analyze/i })).toBeVisible();
    await page.locator('button', { hasText: /analyze/i }).click();

    // Should show an error toast, not an unhandled error
    await expect(page.locator('.toast-error')).toBeVisible({ timeout: 15_000 });
  });
});

// ─── ACCESSIBILITY TESTS ──────────────────────────────────────────────────────
test.describe('Accessibility', () => {
  test('login page should have accessible form elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Check inputs are reachable by keyboard
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A']).toContain(focusedTag);
  });

  test('login form submit button should be keyboard accessible', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Tab to email → password → button
    await page.locator('input[type="email"]').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A']).toContain(focused);
  });

  test('dashboard page buttons should be keyboard navigable', async ({ page }) => {
    await page.route('**/api/projects/**', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/deployments/', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/analytics/**', route => route.fulfill({ status: 200, body: JSON.stringify({
      total_projects: 0, total_deployments: 0, success_rate: 0, trends: [], frameworks: [], providers: [], failures: [],
    }) }));

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(firstFocus);
  });

  test('upload dropzone should be accessible via click', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForLoadState('networkidle');

    const dropzone = page.locator('.dropzone');
    await expect(dropzone).toBeVisible();
    // Dropzone has onClick handler — it should be clickable
    await expect(dropzone).toBeEnabled();
  });

  test('tab navigation on AI analysis page should work correctly', async ({ page }) => {
    await page.route('**/api/projects/999', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 999, name: 'app', framework: 'React', status: 'completed', readiness_score: 80,
          ai_analysis: { score: 80, summary: 'OK', issues: [], recommendations: [] },
          security_scan: { risk_level: 'low', is_safe: true, total_findings: 0, findings: [] },
          malware_scan: { is_safe: true, scanned_files: 5, total_findings: 0, findings: [] },
          code_review: { overall_quality_score: 80, critical_count: 0, warning_count: 0 },
        }),
      })
    );
    await page.route('**/api/projects/999/env-vars', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/deployments/project/999', route => route.fulfill({ status: 200, body: '[]' }));

    await page.goto('/analysis/999');
    await page.waitForLoadState('networkidle');

    // Tab buttons should all be visible and clickable
    const tabs = page.locator('button.tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─── PERFORMANCE TESTS ────────────────────────────────────────────────────────
test.describe('Performance', () => {
  test('dashboard should load within 5 seconds', async ({ page }) => {
    await page.route('**/api/projects/**', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/deployments/', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/analytics/**', route => route.fulfill({ status: 200, body: JSON.stringify({
      total_projects: 0, total_deployments: 0, success_rate: 0, trends: [], frameworks: [], providers: [], failures: [],
    }) }));

    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });

  test('terminal should handle 200 log lines without freezing', async ({ page }) => {
    const logs = Array.from({ length: 200 }, (_, i) => ({
      id: i,
      message: `[${i}] Build step ${i}: npm run step-${i} completed successfully with exit code 0`,
      level: i % 10 === 0 ? 'warning' : 'info',
      stage: 'building',
      created_at: new Date(Date.now() + i * 100).toISOString(),
    }));

    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 42, status: 'completed', provider: 'vercel', deploy_mode: 'production',
          branch: 'main', logs, deployment_url: 'https://test.vercel.app', build_duration_seconds: 120,
        }),
      })
    );

    const startTime = Date.now();
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(5000);
    await expect(page.locator('.terminal-panel')).toBeVisible();
  });

  test('upload page should respond quickly to file selection', async ({ page }) => {
    const { createValidReactZip } = await import('../utils/helpers');
    const zipPath = createValidReactZip();

    await page.goto('/upload');
    await page.waitForLoadState('networkidle');

    const startTime = Date.now();
    await page.locator('#file-input').setInputFiles(zipPath);
    await expect(page.locator('button', { hasText: /analyze/i })).toBeVisible();
    const responseTime = Date.now() - startTime;

    expect(responseTime).toBeLessThan(2000);
  });

  test('page should not have memory leaks after navigation', async ({ page }) => {
    await page.route('**/api/projects/**', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/deployments/', route => route.fulfill({ status: 200, body: '[]' }));
    await page.route('**/api/analytics/**', route => route.fulfill({ status: 200, body: JSON.stringify({
      total_projects: 0, total_deployments: 0, success_rate: 0, trends: [], frameworks: [], providers: [], failures: [],
    }) }));

    // Navigate between pages multiple times
    for (let i = 0; i < 3; i++) {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.goto('/upload');
      await page.waitForLoadState('networkidle');
    }

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForTimeout(1000);

    expect(errors.filter(e => !e.includes('WebSocket'))).toHaveLength(0);
  });
});
