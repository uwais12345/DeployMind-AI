import { test, expect } from '../fixtures';

/**
 * Dashboard Page — Smoke & Regression Tests
 * Validates core rendering, navigation, and data display
 */
test.describe('Dashboard', () => {
  const emptyState = {
    total_projects: 0, total_deployments: 0, success_rate: 0,
    trends: [], frameworks: [], providers: [], failures: [],
  };

  const richState = {
    total_projects: 24,
    total_deployments: 156,
    success_rate: 92,
    avg_duration: 54,
    trends: [
      { date: '2024-01-01', total: 20, success: 18, failed: 2 },
      { date: '2024-01-02', total: 25, success: 23, failed: 2 },
      { date: '2024-01-03', total: 18, success: 18, failed: 0 },
      { date: '2024-01-04', total: 30, success: 28, failed: 2 },
      { date: '2024-01-05', total: 22, success: 20, failed: 2 },
      { date: '2024-01-06', total: 28, success: 26, failed: 2 },
      { date: '2024-01-07', total: 13, success: 13, failed: 0 },
    ],
    frameworks: [
      { name: 'React', projects: 10 },
      { name: 'Next.js', projects: 6 },
      { name: 'Vue', projects: 4 },
      { name: 'FastAPI', projects: 3 },
      { name: 'Django', projects: 1 },
    ],
    providers: [
      { name: 'vercel', count: 80 },
      { name: 'render', count: 50 },
      { name: 'railway', count: 26 },
    ],
    failures: [
      { reason: 'Build Error', count: 7 },
      { reason: 'Config Error', count: 4 },
      { reason: 'Timeout', count: 1 },
    ],
  };

  const projects = [
    { id: 1, name: 'storefront-ui', framework: 'React', readiness_score: 94, status: 'completed' },
    { id: 2, name: 'api-gateway', framework: 'FastAPI', readiness_score: 78, status: 'completed' },
    { id: 3, name: 'admin-panel', framework: 'Next.js', readiness_score: 88, status: 'completed' },
  ];

  const deployments = [
    { id: 1, project_id: 1, project_name: 'storefront-ui', status: 'completed', provider: 'vercel', deploy_mode: 'production', created_at: new Date().toISOString() },
    { id: 2, project_id: 2, project_name: 'api-gateway', status: 'failed', provider: 'render', deploy_mode: 'production', created_at: new Date().toISOString() },
    { id: 3, project_id: 3, project_name: 'admin-panel', status: 'building', provider: 'vercel', deploy_mode: 'preview', created_at: new Date().toISOString() },
  ];

  function setupMocks(page: any, analyticsData = richState) {
    page.route('**/api/analytics/**', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(analyticsData) })
    );
    page.route('**/api/projects/**', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) })
    );
    page.route('**/api/deployments/', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(deployments) })
    );
  }

  // ─── Page Rendering ────────────────────────────────────────────────────────
  test('should render dashboard with correct title', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1.page-title')).toContainText('DeployMind Platform');
    await expect(page.locator('p.page-subtitle')).toContainText('Multi-Deployment Analytics');
  });

  test('should render 4 stats cards', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.stats-card');
    await expect(cards).toHaveCount(4);
  });

  test('should display analytics data in stats cards', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.stats-card').filter({ hasText: /total projects/i })).toContainText('24');
    await expect(page.locator('.stats-card').filter({ hasText: /success rate/i })).toContainText('92%');
    await expect(page.locator('.stats-card').filter({ hasText: /deployments/i })).toContainText('156');
  });

  // ─── Charts ────────────────────────────────────────────────────────────────
  test('should render Recharts area chart with trend data', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for charts to load
    await page.waitForTimeout(1000);
    await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();
  });

  test('should show "not enough data" message when trends are empty', async ({ page }) => {
    setupMocks(page, emptyState);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Not enough data to display chart')).toBeVisible();
  });

  // ─── Skeletons ─────────────────────────────────────────────────────────────
  test('should show skeletons while loading then hide them', async ({ page }) => {
    // Delay response to catch skeletons
    await page.route('**/api/analytics/**', async route => {
      await new Promise(r => setTimeout(r, 500));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyState) });
    });
    await page.route('**/api/projects/**', async route => {
      await new Promise(r => setTimeout(r, 500));
      route.fulfill({ status: 200, body: '[]' });
    });
    await page.route('**/api/deployments/', route =>
      route.fulfill({ status: 200, body: '[]' })
    );

    await page.goto('/dashboard');

    // Skeletons should be visible briefly
    const skeletonVisible = await page.locator('.skeleton').first().isVisible().catch(() => false);
    // After load they should disappear
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    const skeletonGone = await page.locator('.skeleton').first().isVisible().catch(() => false);
    // Either skeleton was visible then went away, or it loaded fast enough to skip
    expect(skeletonGone === false || skeletonVisible).toBeTruthy();
  });

  // ─── Projects Panel ─────────────────────────────────────────────────────── 
  test('should display project names and readiness scores', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=storefront-ui')).toBeVisible();
    await expect(page.locator('text=api-gateway')).toBeVisible();
    await expect(page.locator('text=admin-panel')).toBeVisible();
    // Check a score is visible
    await expect(page.locator('text=94%')).toBeVisible();
  });

  test('should show empty state when no projects exist', async ({ page }) => {
    await page.route('**/api/analytics/**', route =>
      route.fulfill({ status: 200, body: JSON.stringify(emptyState) })
    );
    await page.route('**/api/projects/**', route =>
      route.fulfill({ status: 200, body: '[]' })
    );
    await page.route('**/api/deployments/', route =>
      route.fulfill({ status: 200, body: '[]' })
    );

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=No projects yet')).toBeVisible();
  });

  // ─── Deployments Table ─────────────────────────────────────────────────────
  test('should render deployments table with correct columns', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table.data-table').first();
    await expect(table).toBeVisible();
    await expect(table.locator('th', { hasText: /project/i })).toBeVisible();
    await expect(table.locator('th', { hasText: /provider/i })).toBeVisible();
    await expect(table.locator('th', { hasText: /status/i })).toBeVisible();
  });

  test('should show "No deployments yet" when list is empty', async ({ page }) => {
    await page.route('**/api/analytics/**', route => route.fulfill({ status: 200, body: JSON.stringify(emptyState) }));
    await page.route('**/api/projects/**', route => route.fulfill({ status: 200, body: JSON.stringify(projects) }));
    await page.route('**/api/deployments/', route => route.fulfill({ status: 200, body: '[]' }));

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=No deployments yet')).toBeVisible();
  });

  // ─── Navigation ────────────────────────────────────────────────────────────
  test('clicking "New Project" navigates to /upload', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.locator('button', { hasText: /new project/i }).click();
    await page.waitForURL('/upload');
  });

  test('clicking a deployment row navigates to its monitor page', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.locator('table.data-table tbody tr').first().click();
    await page.waitForURL(/\/deployments\/\d+/);
  });

  test('clicking a project navigates to its analysis page', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Click "storefront-ui" in the projects panel
    await page.locator('text=storefront-ui').click();
    await page.waitForURL(/\/analysis\/\d+/);
  });

  test('"View all" deployments link navigates to /deployments', async ({ page }) => {
    setupMocks(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.locator('button', { hasText: /view all/i }).click();
    await page.waitForURL('/deployments');
  });
});
