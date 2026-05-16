import { test as base, expect, type APIRequestContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as archiver from 'archiver';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { UploadPage } from '../pages/UploadPage';
import { AIAnalysisPage } from '../pages/AIAnalysisPage';
import { DeploymentMonitorPage } from '../pages/DeploymentMonitorPage';

// ─── Types ────────────────────────────────────────────────────────────────────
type TestUser = {
  email: string;
  password: string;
  name: string;
};

type Fixtures = {
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
  uploadPage: UploadPage;
  analysisPage: AIAnalysisPage;
  monitorPage: DeploymentMonitorPage;
  testUser: TestUser;
  apiContext: APIRequestContext;
  authToken: string;
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
export const test = base.extend<Fixtures>({
  testUser: async ({}, use) => {
    await use({
      email: process.env.TEST_USER_EMAIL ?? 'playwright.test@deploymind.ai',
      password: process.env.TEST_USER_PASSWORD ?? 'Playwright@123!',
      name: process.env.TEST_USER_NAME ?? 'Playwright Tester',
    });
  },

  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.API_URL ?? 'http://localhost:8000',
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
    await use(context);
    await context.dispose();
  },

  authToken: async ({ apiContext, testUser }, use) => {
    const res = await apiContext.post('/api/users/login', {
      data: { email: testUser.email, password: testUser.password },
    });
    const body = await res.json();
    await use(body.access_token);
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  uploadPage: async ({ page }, use) => {
    await use(new UploadPage(page));
  },

  analysisPage: async ({ page }, use) => {
    await use(new AIAnalysisPage(page));
  },

  monitorPage: async ({ page }, use) => {
    await use(new DeploymentMonitorPage(page));
  },
});

export { expect };
