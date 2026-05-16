# DeployMind AI — Playwright E2E Testing Infrastructure

> **Enterprise-grade automated QA for an AI-powered deployment orchestration platform.**

---

## 📐 Architecture Overview

```
frontend/
├── playwright.config.ts          # Multi-browser Playwright configuration
├── tsconfig.playwright.json      # TypeScript config for test files
├── tests/e2e/
│   ├── .env.test                 # Test environment variables
│   ├── .auth/                    # Saved auth state (git-ignored)
│   ├── global.setup.ts           # One-time auth setup (runs before all tests)
│   ├── fixtures/
│   │   ├── index.ts              # Reusable fixtures (page objects, API context)
│   │   └── zips/                 # Generated test ZIP files (git-ignored)
│   ├── pages/                    # Page Object Models
│   │   ├── LoginPage.ts
│   │   ├── RegisterPage.ts
│   │   ├── DashboardPage.ts
│   │   ├── UploadPage.ts
│   │   ├── AIAnalysisPage.ts
│   │   └── DeploymentMonitorPage.ts
│   ├── utils/
│   │   └── helpers.ts            # ZIP generators, API helpers, polling
│   ├── auth/
│   │   └── auth.spec.ts          # Registration, login, JWT, protected routes
│   ├── upload/
│   │   └── upload.spec.ts        # File selection, validation, progress, cancel
│   ├── analysis/
│   │   └── analysis.spec.ts      # AI score, tabs, fallbacks, malformed responses
│   ├── security/
│   │   └── security.spec.ts      # Secret detection, severity badges, blockers
│   ├── deployment/
│   │   └── deployment.spec.ts    # Monitor UI, log filtering, actions
│   ├── websocket/
│   │   └── websocket.spec.ts     # WS connection, live updates, reconnect
│   ├── rollback/
│   │   └── rollback.spec.ts      # Retry, rollback, navigation, dialogs
│   ├── analytics/
│   │   ├── analytics.spec.ts     # Stats cards, charts, empty states
│   │   └── dashboard.spec.ts     # Dashboard smoke & regression tests
│   ├── diagnostics/
│   │   ├── diagnostics.spec.ts   # Failure sim, accessibility, performance
│   │   └── terminal.spec.ts      # Terminal rendering, large logs, AI diagnostics
│   └── visual/
│       └── visual.spec.ts        # Screenshot-based visual regression
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd frontend
npm install
npx playwright install chromium   # Minimum for local dev
# OR: npx playwright install      # All browsers (Chromium, Firefox, WebKit)
```

### 2. Configure environment
The file `tests/e2e/.env.test` contains test credentials.
Ensure a test user exists in your database:

```env
BASE_URL=http://localhost:5173
API_URL=http://localhost:8000
WS_URL=ws://localhost:8000
TEST_USER_EMAIL=playwright.test@deploymind.ai
TEST_USER_PASSWORD=Playwright@123!
TEST_USER_NAME=Playwright Tester
```

The `global.setup.ts` automatically registers this test user if it doesn't exist.

### 3. Start the application
```bash
# Terminal 1 — Backend
cd backend
uvicorn main:app --reload

# Terminal 2 — Frontend (Playwright's webServer will auto-start in dev mode)
# Nothing needed — playwright.config.ts starts Vite automatically
```

### 4. Run tests
```bash
# All tests (Chromium only — fastest for dev)
npm run test:e2e:chromium

# All browsers
npm run test:e2e

# With headed browser (see what's happening)
npm run test:e2e:headed

# Interactive UI mode (recommended for debugging)
npm run test:e2e:ui

# Specific test file
npx playwright test auth/auth.spec.ts

# Specific test by name
npx playwright test --grep "should login successfully"

# Open HTML report after run
npm run test:e2e:report
```

---

## 🧪 Test Suites

| Suite | File | Tests | Description |
|-------|------|-------|-------------|
| **Auth** | `auth/auth.spec.ts` | 12 | Registration, login, JWT persistence, protected routes, logout |
| **Upload** | `upload/upload.spec.ts` | 12 | File selection, ZIP validation, progress bar, cancellation |
| **AI Analysis** | `analysis/analysis.spec.ts` | 10 | Score rendering, tab navigation, fallback states |
| **Security** | `security/security.spec.ts` | 7 | Secret detection, findings table, severity badges, blockers |
| **Deployment** | `deployment/deployment.spec.ts` | 12 | Monitor UI, action buttons, log filtering |
| **WebSocket** | `websocket/websocket.spec.ts` | 8 | WS connection, live updates, reconnect, no crash |
| **Rollback** | `rollback/rollback.spec.ts` | 8 | Retry/rollback API, navigation, confirmation dialogs |
| **Analytics** | `analytics/analytics.spec.ts` | 11 | Stats cards, charts, empty states, navigation |
| **Dashboard** | `analytics/dashboard.spec.ts` | 14 | Full dashboard smoke tests |
| **Terminal** | `diagnostics/terminal.spec.ts` | 14 | Log rendering, 500 logs, search/filter, AI diagnostics |
| **Diagnostics** | `diagnostics/diagnostics.spec.ts` | 13 | Failure sim, accessibility, performance |
| **Visual** | `visual/visual.spec.ts` | 8 | Screenshot regression (login, dashboard, analysis, monitor) |

**Total: ~129 tests**

---

## 🏗️ Design Principles

### Page Object Model (POM)
All page interactions are encapsulated in `tests/e2e/pages/`. Tests never access raw locators directly — they call POM methods:

```typescript
// ✅ Good
await loginPage.loginAndWaitForDashboard(email, password);

// ❌ Avoid
await page.fill('input[type="email"]', email);
```

### API Mocking for Unit-Style E2E
Most tests mock the API with `page.route()` to be:
- **Fast** — no backend dependency for UI tests
- **Deterministic** — no flakiness from real data
- **Comprehensive** — test every edge case (500, 404, malformed)

Integration tests that **do** hit the real backend are clearly marked.

### Resilient Selectors
We avoid brittle CSS class selectors in favor of:
- `data-testid` attributes (stable, semantic)
- Text-based locators (`{ hasText: /deploy now/i }`)
- ARIA roles and labels

### No Arbitrary Sleeps
We use:
- `page.waitForURL()` for navigation
- `page.waitForLoadState('networkidle')` for data loading
- `expect(...).toBeVisible({ timeout })` for elements
- `page.waitForFunction()` for custom conditions

---

## 🔑 Key Selectors Reference

| Element | Selector |
|---------|----------|
| Deploy steps container | `[data-testid="deploy-steps"]` |
| Individual step | `[data-testid="deploy-step-building"]` |
| Terminal body | `[data-testid="terminal-body"]` |
| Log line (any) | `.log-line` |
| Error log | `.log-error` |
| Warning log | `.log-warning` |
| Success log | `.log-success` |
| Stats card | `.stats-card` |
| Upload dropzone | `.dropzone` |
| File input | `#file-input` |
| Progress bar | `.progress-bar-fill` |
| Toast (success) | `.toast-success` |
| Toast (error) | `.toast-error` |
| Tab button | `button.tab` |
| Active tab | `button.tab.active` |
| Diagnostics panel | `.diagnostics-panel` |

---

## 🔁 CI/CD Integration

The GitHub Actions workflow at `.github/workflows/playwright.yml` provides:

- **Chromium tests** on every PR and push to `main`/`develop`
- **Firefox + WebKit** on push to `main` only
- **Artifact uploads** for HTML reports, screenshots, and trace files
- **PR comments** with test result summaries
- **Retry support** (2 retries on CI, 1 on local)

### Required Secrets (GitHub → Settings → Secrets)
```
GROQ_API_KEY       # For backend AI features during integration tests
```

---

## 🖼️ Visual Regression

First run — generate baseline snapshots:
```bash
npm run test:e2e:snapshots
```

Subsequent runs — compare against baseline:
```bash
npx playwright test visual/
```

Update snapshots after intentional UI changes:
```bash
npm run test:e2e:snapshots
```

---

## 🐛 Debugging Failures

```bash
# Step through failing test in UI mode
npm run test:e2e:ui

# Run with headed browser + slow motion
npx playwright test --headed --slow-mo=500 auth/

# Show trace viewer for a failed test
npx playwright show-trace test-results/*/trace.zip

# Run a single test with full debug output
PWDEBUG=1 npx playwright test --grep "should login successfully"
```

---

## 📊 Reports

After each test run:
```bash
npm run test:e2e:report   # Opens HTML report in browser
```

The HTML report includes:
- ✅ Pass/Fail status per test
- 📸 Screenshots on failure
- 🎥 Video recordings on failure  
- 🔍 Trace viewer link for step-by-step replay
- ⏱️ Timing per test

---

## 🧩 Adding New Tests

1. Create a new spec file in the appropriate `tests/e2e/<domain>/` folder
2. Import fixtures: `import { test, expect } from '../fixtures';`
3. Use POMs for page interactions
4. Mock APIs with `page.route()` for fast, deterministic execution
5. Add `data-testid` to any new UI component that needs testing

---

*DeployMind AI E2E Testing — Built with ❤️ and Playwright*
