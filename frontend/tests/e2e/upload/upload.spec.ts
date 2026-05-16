import { test, expect } from '../fixtures';
import * as path from 'path';
import {
  createValidReactZip,
  createOversizedZip,
  createNonZipFile,
  createInvalidZip,
} from '../utils/helpers';

/**
 * PART 4 — Project Upload Tests
 * Covers: ZIP drag-and-drop, upload progress, cancellation,
 *         invalid ZIP handling, oversized ZIP rejection
 */
test.describe('Project Upload', () => {
  test.beforeEach(async ({ uploadPage }) => {
    await uploadPage.goto();
  });

  // ─── Page Rendering ─────────────────────────────────────────────────────────
  test('should render upload page with all elements', async ({ page, uploadPage }) => {
    await expect(uploadPage.pageTitle).toContainText('Upload Project');
    await expect(uploadPage.dropzone).toBeVisible();
    await expect(page.locator('text=Drop your project ZIP here')).toBeVisible();
    await expect(page.locator('text=AI Analysis')).toBeVisible();
    await expect(page.locator('text=Security Scan')).toBeVisible();
    await expect(page.locator('text=Auto Deploy')).toBeVisible();
  });

  test('should show browse files text in dropzone', async ({ page }) => {
    await expect(page.locator('span', { hasText: /browse files/i })).toBeVisible();
  });

  // ─── File Selection ─────────────────────────────────────────────────────────
  test('should accept a valid ZIP file via file input', async ({ uploadPage }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);

    await uploadPage.expectFileSelected(path.basename(zipPath));
    await expect(uploadPage.uploadButton).toBeVisible();
  });

  test('should show file size after selection', async ({ uploadPage }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);

    // File size should be displayed
    await expect(uploadPage.dropzone).toContainText('MB');
  });

  test('should show remove button after file selection', async ({ uploadPage }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);
    await expect(uploadPage.removeFileButton).toBeVisible();
  });

  test('should clear file selection when Remove is clicked', async ({ page, uploadPage }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);
    await uploadPage.removeFileButton.click();

    // Back to empty state
    await expect(page.locator('text=Drop your project ZIP here')).toBeVisible();
    await expect(uploadPage.uploadButton).not.toBeVisible();
  });

  // ─── File Validation ────────────────────────────────────────────────────────
  test('should reject non-ZIP files and show error toast', async ({ uploadPage }) => {
    const txtPath = createNonZipFile();
    await uploadPage.uploadFile(txtPath);
    await uploadPage.expectToast('error');
    await expect(uploadPage.uploadButton).not.toBeVisible();
  });

  test('should reject oversized ZIP (>100MB) and show error toast', async ({ uploadPage }) => {
    const largePath = createOversizedZip();
    await uploadPage.uploadFile(largePath);
    await uploadPage.expectToast('error');
  });

  // ─── Upload Progress ─────────────────────────────────────────────────────────
  test('should show progress bar during upload', async ({ page, uploadPage }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);
    await expect(uploadPage.uploadButton).toBeVisible();
    await uploadPage.uploadButton.click();

    // Progress bar should appear
    await expect(uploadPage.progressBar).toBeVisible({ timeout: 8_000 });
  });

  test('should show stage label during upload', async ({ page, uploadPage }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);
    await uploadPage.uploadButton.click();

    // Stage label should be visible
    await expect(page.locator('text=Uploading ZIP...')).toBeVisible({ timeout: 8_000 });
  });

  test('should show Cancel button during upload', async ({ uploadPage }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);
    await uploadPage.uploadButton.click();
    await expect(uploadPage.cancelButton).toBeVisible({ timeout: 8_000 });
  });

  // ─── Upload Cancellation ─────────────────────────────────────────────────────
  test('should cancel an in-progress upload', async ({ uploadPage, page }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);
    await uploadPage.uploadButton.click();

    // Wait for cancel button, then click
    await expect(uploadPage.cancelButton).toBeVisible({ timeout: 10_000 });
    await uploadPage.cancelButton.click();

    await uploadPage.expectToast('warning');
    await expect(page.locator('text=cancelled', { exact: false })).toBeVisible({ timeout: 5_000 });
  });

  // ─── Processing State ────────────────────────────────────────────────────────
  test('should show AI analysis terminal when upload completes', async ({ page, uploadPage }) => {
    const zipPath = createValidReactZip();
    await uploadPage.uploadFile(zipPath);
    await uploadPage.uploadButton.click();

    // Wait for 100% progress — terminal mock appears
    await expect(page.locator('text=analyze_codebase --ai=groq')).toBeVisible({ timeout: 30_000 });
  });

  // ─── Dropzone Styling ────────────────────────────────────────────────────────
  test('should highlight dropzone on drag over', async ({ page }) => {
    const dropzone = page.locator('.dropzone');
    // Dispatch drag events manually
    await dropzone.dispatchEvent('dragover', { dataTransfer: {} });
    await expect(dropzone).toHaveClass(/active/);
  });
});
