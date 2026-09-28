import { test, expect } from '@playwright/test';
import { ADMIN, loginAs, resetData } from './helpers.ts';

test.beforeEach(async ({ page, request }) => {
  await resetData(request);
  await loginAs(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'New transaction' }).click();
  await expect(page.getByRole('heading', { name: 'New transaction' })).toBeVisible();
});

test('creates a valid transaction and confirms it', async ({ page }) => {
  await page.getByLabel('Agent ID').fill('1');
  await page.getByLabel('Amount (₹)').fill('750');
  await page.getByLabel('Phone').fill('9876543210');
  await page.getByRole('button', { name: 'Create transaction' }).click();
  await expect(page.getByRole('status')).toContainText('for ₹750');
});

test('rejects an invalid amount with a clear error', async ({ page }) => {
  await page.getByLabel('Agent ID').fill('1');
  await page.getByLabel('Amount (₹)').fill('0');
  await page.getByLabel('Phone').fill('9876543210');
  await page.getByRole('button', { name: 'Create transaction' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid transaction');
});

test('rejects a badly formatted phone number', async ({ page }) => {
  await page.getByLabel('Agent ID').fill('1');
  await page.getByLabel('Amount (₹)').fill('500');
  await page.getByLabel('Phone').fill('12345');
  await page.getByRole('button', { name: 'Create transaction' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});
