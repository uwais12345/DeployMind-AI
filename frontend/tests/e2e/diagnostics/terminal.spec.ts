import { test, expect } from '../fixtures';

/**
 * PART 9 — xterm Terminal Validation
 * Covers: log appending, terminal responsiveness, large log scrolling,
 *         live logs, failure logs, AI diagnostics rendering
 */
test.describe('Terminal & Diagnostics Panel', () => {
  const buildDeployment = (status: string, logs: object[] = [], extra: object = {}) => ({
    id: 42,
    project_id: 1,
    status,
    provider: 'vercel',
    deploy_mode: 'production',
    branch: 'main',
    build_duration_seconds: status === 'completed' ? 63 : null,
    deployment_url: status === 'completed' ? 'https://test.vercel.app' : null,
    error_message: status === 'failed' ? 'Build script exited with code 1' : null,
    logs,
    created_at: new Date().toISOString(),
    ...extra,
  });

  // ─── Terminal Rendering ───────────────────────────────────────────────────
  test('terminal panel should be visible on deployment monitor', async ({ page }) => {
    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('building')),
      })
    );
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.terminal-panel')).toBeVisible();
    await expect(page.locator('.terminal-header')).toBeVisible();
    await expect(page.locator('.terminal-body')).toBeVisible();
  });

  test('terminal header should show correct filename', async ({ page }) => {
    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('building')),
      })
    );
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.terminal-header')).toContainText('deployment-42.log');
  });

  test('terminal dot indicators should be visible', async ({ page }) => {
    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('building')),
      })
    );
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    const dots = page.locator('.terminal-dot');
    await expect(dots).toHaveCount(3);
  });

  // ─── Log Lines ────────────────────────────────────────────────────────────
  test('should render info log lines correctly', async ({ page }) => {
    const logs = [
      { id: 1, message: 'Deployment started', level: 'info', stage: 'preparing', created_at: new Date().toISOString() },
      { id: 2, message: 'Installing npm packages', level: 'info', stage: 'building', created_at: new Date().toISOString() },
    ];

    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('building', logs)),
      })
    );
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.log-line').first()).toBeVisible();
    await expect(page.locator('text=Deployment started')).toBeVisible();
  });

  test('should render warning log lines with correct color class', async ({ page }) => {
    const logs = [
      { id: 1, message: 'Deprecated API used in src/app.js', level: 'warning', stage: 'building', created_at: new Date().toISOString() },
    ];

    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('building', logs)),
      })
    );
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.log-warning')).toBeVisible();
    await expect(page.locator('.log-warning')).toContainText('Deprecated API');
  });

  test('should render error log lines', async ({ page }) => {
    const logs = [
      { id: 1, message: 'FATAL: Cannot find module react-dom/client', level: 'error', stage: 'building', created_at: new Date().toISOString() },
    ];

    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('failed', logs)),
      })
    );
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.log-error')).toBeVisible();
    await expect(page.locator('.log-error')).toContainText('FATAL');
  });

  test('should render success log lines', async ({ page }) => {
    const logs = [
      { id: 1, message: 'Build completed in 45.2s', level: 'success', stage: 'deploying', created_at: new Date().toISOString() },
    ];

    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('completed', logs)),
      })
    );
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.log-success')).toBeVisible();
    await expect(page.locator('.log-success')).toContainText('Build completed');
  });

  // ─── Large Log Volume ──────────────────────────────────────────────────────
  test('terminal should handle 500 log lines without freezing', async ({ page }) => {
    const logs = Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      message: `Step ${i + 1}: Processing file chunk ${i * 100}-${(i + 1) * 100} of 50000 bytes`,
      level: i % 20 === 0 ? 'warning' : 'info',
      stage: 'building',
      created_at: new Date(Date.now() + i * 50).toISOString(),
    }));

    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('completed', logs, { deployment_url: 'https://test.vercel.app', build_duration_seconds: 240 })),
      })
    );

    const startTime = Date.now();
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');
    const renderTime = Date.now() - startTime;

    // Should render within 5 seconds even with 500 logs
    expect(renderTime).toBeLessThan(5000);
    await expect(page.locator('.terminal-panel')).toBeVisible();
    await expect(page.locator('.log-line').first()).toBeVisible();

    // Check UI remains responsive by clicking a filter button
    await page.locator('button').filter({ hasText: /^all$/i }).first().click();
    await page.waitForTimeout(300);
    // No crash — filter button click should work
    await expect(page.locator('.terminal-panel')).toBeVisible();
  });

  // ─── Log Search & Filter ──────────────────────────────────────────────────
  test('search should filter visible log lines', async ({ page }) => {
    const logs = [
      { id: 1, message: 'npm install completed', level: 'info', stage: 'building', created_at: new Date().toISOString() },
      { id: 2, message: 'Running vite build', level: 'info', stage: 'building', created_at: new Date().toISOString() },
      { id: 3, message: 'WARN: Missing peer dependency', level: 'warning', stage: 'building', created_at: new Date().toISOString() },
    ];

    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('completed', logs, { build_duration_seconds: 30, deployment_url: 'https://t.vercel.app' })),
      })
    );

    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder="Search logs..."]');
    await searchInput.fill('vite');

    // Only the vite log should remain
    await expect(page.locator('text=Running vite build')).toBeVisible();
    await expect(page.locator('text=npm install completed')).not.toBeVisible();
  });

  // ─── Copy & Export ────────────────────────────────────────────────────────
  test('Copy Logs button should be visible and clickable', async ({ page }) => {
    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('completed', [], { deployment_url: 'https://t.vercel.app', build_duration_seconds: 10 })),
      })
    );
    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    const copyBtn = page.locator('button[title="Copy Logs"]');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    // Should show success toast
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5_000 });
  });

  // ─── AI Diagnostics Panel ─────────────────────────────────────────────────
  test('should show AI diagnostics panel for failed deployment', async ({ page }) => {
    const failedDeployment = buildDeployment('failed', [
      { id: 1, message: 'ERR! code ENOENT — no such file: package.json', level: 'error', stage: 'building', created_at: new Date().toISOString() },
    ]);

    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(failedDeployment),
      })
    );

    // Mock the diagnostics API
    await page.route('**/api/deployments/42/diagnostics', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          severity: 'critical',
          reason: 'package.json not found at project root',
          fix_suggestion: 'Ensure your ZIP file contains package.json at the root level, not inside a subdirectory.',
        }),
      })
    );

    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    // Diagnostics panel should appear (triggered automatically for failed deployments)
    await expect(page.locator('.diagnostics-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.panel-label', { hasText: 'AI DIAGNOSTICS' })).toBeVisible();
  });

  test('AI diagnostics should render severity badge and fix suggestion', async ({ page }) => {
    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('failed', [])),
      })
    );
    await page.route('**/api/deployments/42/diagnostics', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          severity: 'warning',
          reason: 'Build script not configured in package.json',
          fix_suggestion: 'Add "build": "vite build" to the scripts section of package.json.',
        }),
      })
    );

    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500); // Wait for diagnostics fetch

    const panel = page.locator('.diagnostics-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.locator('.severity-badge')).toBeVisible();
    await expect(panel.locator('.suggestion-box')).toBeVisible();
    await expect(panel.locator('.suggestion-text')).toContainText('vite build');
  });

  test('should show "Analyzing logs..." spinner while fetching diagnostics', async ({ page }) => {
    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('failed', [])),
      })
    );

    // Simulate a slow diagnostics response
    await page.route('**/api/deployments/42/diagnostics', async route => {
      await new Promise(r => setTimeout(r, 2000));
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ severity: 'info', reason: 'Minor issue', fix_suggestion: 'Check logs.' }),
      });
    });

    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    // While fetching, should show analyzing state
    await expect(page.locator('text=Analyzing logs...')).toBeVisible({ timeout: 5_000 });
  });

  // ─── No crash scenarios ────────────────────────────────────────────────────
  test('terminal should not crash with empty logs array', async ({ page }) => {
    await page.route('**/api/deployments/42', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(buildDeployment('queued', [])),
      })
    );

    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/deployments/42');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.terminal-panel')).toBeVisible();
    expect(errors.filter(e => !e.includes('WebSocket'))).toHaveLength(0);
  });
});
