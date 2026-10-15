import { test, expect } from '@playwright/test';

test('real Compact compile matches the reviewed public schema and downloads provenance', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: /know what your contract/i })).toBeVisible();
  await expect(page.getByLabel('Compact source path')).toHaveValue('examples/ledger-schema-smoke.compact');
  await expect(page.getByLabel('Reviewed policy path')).toHaveValue('examples/ledger-schema-smoke.policy.json');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /compile & compare/i }).click();
  await expect(page.getByRole('heading', { name: 'Compiled schema matches policy.' })).toBeVisible({ timeout: 10 * 60 * 1000 });
  await expect(page.getByText(/Compact 0\.31\.1/)).toBeVisible();
  await expect(page.getByText('message', { exact: true })).toBeVisible();
  const download = await downloadPromise;
  const file = test.info().outputPath('gate-report.json');
  await download.saveAs(file);
  const report = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
  expect(report.result).toBe('PASS');
  expect(pageErrors).toEqual([]);
});

test('real public-field addition is blocked and shown as a precise diff', async ({ page }) => {
  await page.goto('/app');
  await page.getByLabel('Compact source path').fill('examples/ledger-schema-smoke-mutated.compact');
  await page.getByRole('button', { name: /compile & compare/i }).click();
  await expect(page.getByRole('heading', { name: /public-ledger schema change/i })).toBeVisible({ timeout: 10 * 60 * 1000 });
  await expect(page.getByText(/UNAPPROVED: revision/)).toBeVisible();
  await expect(page.getByText(/storage.*Cell/)).toBeVisible();
});

test('path escape and missing policy remain honest errors', async ({ page }) => {
  await page.goto('/app');
  await page.getByLabel('Compact source path').fill('../outside.compact');
  await page.getByRole('button', { name: /compile & compare/i }).click();
  await expect(page.getByRole('heading', { name: /outside CPG_PROJECT_ROOT/i })).toBeVisible();
  await page.getByLabel('Compact source path').fill('examples/ledger-schema-smoke.compact');
  await page.getByLabel('Reviewed policy path').fill('missing-policy.json');
  await page.getByRole('button', { name: /compile & compare/i }).click();
  await expect(page.getByRole('heading', { name: /cannot open|cannot read/i })).toBeVisible();
});

test('mobile layout and reduced-motion context preserve usable controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/app');
  await expect(page.getByRole('button', { name: /compile & compare/i })).toBeVisible();
  await expect(page.getByLabel('Compact source path')).toBeVisible();
  await expect(page.getByLabel('Reviewed policy path')).toBeVisible();
});

test('landing page explains the product and leads into the working gate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /privacy starts with knowing/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /review a contract/i })).toHaveAttribute('href', '/app');
  await expect(page.getByRole('heading', { name: /from source change to informed review/i })).toBeVisible();
  await page.getByRole('link', { name: /review a contract/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByLabel('Compact source path')).toBeVisible();
  await expect(page.getByRole('heading', { name: /run the private witness path/i })).toBeVisible();
  await expect(page.getByText(/not run\. start the local devnet first/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /deploy and verify locally/i })).toBeEnabled();
});
