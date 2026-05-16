import { test, expect } from '../fixtures';

/**
 * PART 10 — Analytics Dashboard Tests
 * Covers: stats cards, charts, framework metrics, failure metrics,
 *         deployment durations, chart rendering, empty/skeleton states
 */
test.describe('Analytics Dashboard', () => {
  const mockAnalytics = {
    total_projects: 12,
    total_deployments: 48,
    success_rate: 87,
    avg_duration: 63,
    trends: [
      { date: '2024-01-01', total: 5, success: 4, failed: 1 },
      { date: '2024-01-02', total: 8, success: 7, failed: 1 },
      { date: '2024-01-03', total: 6, success: 6, failed: 0 },
      { date: '2024-01-04', total: 10, success: 8, failed: 2 },
      { date: '2024-01-05', total: 7, success: 7, failed: 0 },
      { date: '2024-01-06', total: 9, success: 8, failed: 1 },
      { date: '2024-01-07', total: 3, success: 2, failed: 1 },
    ],
    frameworks: [
      { name: 'React', projects: 6 },
      { name: 'Next.js', projects: 3 },
      { name: 'Vue', projects: 2 },
      { name: 'FastAPI', projects: 1 },
    ],
    providers: [
      { name: 'vercel', count: 30 },
      { name: 'render', count: 12 },
      { name: 'railway', count: 6 },
    ],
    failures: [
      { reason: 'Build Error', count: 8 },
      { reason: 'Timeout', count: 4 },
      { reason: 'Config', count: 2 },
    ],
  };

  const mockProjects: any[] = [
    { id: 1, name: 'react-app', framework: 'React', readiness_score: 88 },
    { id: 2, name: 'api-server', framework: 'FastAPI', readiness_score: 72 },
  ];

  const mockDeployments: any[] = [
    { id: 1, project_id: 1, project_name: 'react-app', status: 'completed', provider: 'vercel', deploy_mode: 'production', created_at: new Date().toISOString() },
    { id: 2, project_id: 2, project_name: 'api-server', status: 'failed', provider: 'render', deploy_mode: 'production', created_at: new Date().toISOString() },
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/analytics/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAnalytics) })
    );
    await page.route('**/api/projects/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProjects) })
    );
    await page.route('**/api/deployments/', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDeployments) })
    );
  });

  // ─── Stats Cards ───────────────────────────────────────────────────────────
  test('should render all 4 stats cards', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.statsCards).toHaveCount(4);
    for (const card of await dashboardPage.statsCards.all()) {
      await expect(card).toBeVisible();
    }
  });

  test('should display correct Total Projects count', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    const projectsCard = page.locator('.stats-card').filter({ hasText: /total projects/i });
    await expect(projectsCard).toContainText('12');
  });

  test('should display correct Success Rate', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    const successCard = page.locator('.stats-card').filter({ hasText: /success rate/i });
    await expect(successCard).toContainText('87%');
  });

  test('should display Deployments count', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    const deploymentsCard = page.locator('.stats-card').filter({ hasText: /deployments/i });
    await expect(deploymentsCard).toContainText('48');
  });

  // ─── Charts Rendering ──────────────────────────────────────────────────────
  test('should render the Deployment Activity area chart', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 10_000 });
  });

  test('should render Frameworks pie chart', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    const chartsGrid = page.locator('.grid-3');
    await expect(chartsGrid).toBeVisible();
    const recharts = page.locator('.recharts-wrapper');
    await expect(recharts).toHaveCount({ min: 2 } as any);
  });

  test('should render Provider Adoption bar chart', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    const chartsCount = await page.locator('.recharts-wrapper').count();
    expect(chartsCount).toBeGreaterThanOrEqual(2);
  });

  test('should render Failures bar chart', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    const chartsCount = await page.locator('.recharts-wrapper').count();
    expect(chartsCount).toBeGreaterThanOrEqual(3);
  });

  // ─── Empty States ──────────────────────────────────────────────────────────
  test('should show "No deployments yet" when list is empty', async ({ page }) => {
    await page.route('**/api/deployments/', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/analytics/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...mockAnalytics, trends: [] }) })
    );
    await page.route('**/api/projects/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=No deployments yet')).toBeVisible();
  });

  test('should show "not enough data to display chart" when trends are empty', async ({ page }) => {
    await page.route('**/api/analytics/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...mockAnalytics, trends: [] }) })
    );
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Not enough data to display chart')).toBeVisible({ timeout: 10_000 });
  });

  // ─── Projects List ─────────────────────────────────────────────────────────
  test('should render recent projects with readiness scores', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    const projects = page.locator('.card').filter({ hasText: /Projects/i });
    await expect(projects).toBeVisible();
    await expect(page.locator('text=react-app')).toBeVisible();
    await expect(page.locator('text=api-server')).toBeVisible();
  });

  // ─── Recent Deployments Table ──────────────────────────────────────────────
  test('should render recent deployments table', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    const table = page.locator('table.data-table').first();
    await expect(table).toBeVisible();
    await expect(table).toContainText('react-app');
  });

  // ─── Navigation ────────────────────────────────────────────────────────────
  test('should navigate to /upload when "New Project" button is clicked', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.newProjectButton.click();
    await page.waitForURL('/upload');
  });

  test('should navigate to deployment monitor when row is clicked', async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    const firstRow = page.locator('table.data-table tbody tr').first();
    await firstRow.click();
    await page.waitForURL(/\/deployments\/\d+/);
  });
});
