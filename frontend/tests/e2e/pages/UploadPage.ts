import { type Page, type Locator, expect } from '@playwright/test';
import * as path from 'path';

/**
 * UploadPage — Page Object Model for /upload
 */
export class UploadPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly dropzone: Locator;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly cancelButton: Locator;
  readonly progressBar: Locator;
  readonly progressPercent: Locator;
  readonly stageLabel: Locator;
  readonly fileNameDisplay: Locator;
  readonly removeFileButton: Locator;
  readonly toastContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1.page-title');
    this.dropzone = page.locator('.dropzone');
    this.fileInput = page.locator('#file-input');
    this.uploadButton = page.locator('button', { hasText: /analyze & deploy/i });
    this.cancelButton = page.locator('button', { hasText: /cancel/i });
    this.progressBar = page.locator('.progress-bar-fill');
    this.progressPercent = page.locator('[style*="text-align: right"]');
    this.stageLabel = page.locator('.spin').locator('..').locator('span');
    this.fileNameDisplay = page.locator('.dropzone').locator('div', { hasText: /.zip/ });
    this.removeFileButton = page.locator('button', { hasText: /remove/i });
    this.toastContainer = page.locator('.toast-container');
  }

  async goto() {
    await this.page.goto('/upload');
    await this.page.waitForLoadState('networkidle');
  }

  async uploadFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
  }

  async uploadAndSubmit(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
    await expect(this.uploadButton).toBeVisible({ timeout: 5_000 });
    await this.uploadButton.click();
  }

  async expectFileSelected(fileName: string) {
    await expect(this.dropzone).toContainText(fileName);
    await expect(this.uploadButton).toBeVisible();
  }

  async expectUploadInProgress() {
    await expect(this.progressBar).toBeVisible({ timeout: 10_000 });
  }

  async expectToast(type: 'success' | 'error' | 'warning') {
    await expect(this.page.locator(`.toast-${type}`)).toBeVisible({ timeout: 10_000 });
  }
}
