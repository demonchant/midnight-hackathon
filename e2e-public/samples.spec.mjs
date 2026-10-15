import { test, expect } from '@playwright/test';

test('public sample workflow lets a judge see a compiler-backed pass and block', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Inspect a Compact schema' })).toBeVisible();

  await page.getByRole('button', { name: 'Run passing example' }).click();
  await expect(page.getByRole('heading', { name: 'Schema matches policy' })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText(/Compiler 0\.31\.1/)).toBeVisible();

  await page.getByRole('button', { name: 'Run schema-change example' }).click();
  await expect(page.getByRole('heading', { name: 'Schema or toolchain differs' })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText(/revision/)).toBeVisible();
  expect(pageErrors).toEqual([]);
});
