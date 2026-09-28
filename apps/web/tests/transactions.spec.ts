import { test, expect } from '@playwright/test';
import { ADMIN, OPERATOR, loginAs, resetData } from './helpers.ts';

test.beforeEach(async ({ page, request }) => {
  await resetData(request);
  await loginAs(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  // Wait for the first page to actually load (header + 10 rows) before reading.
  await expect(page.getByRole('row')).toHaveCount(11);
});

test('lists transactions with a total and a page of rows', async ({ page }) => {
  await expect(page.getByText('of 60 transactions')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(11); // header + 10 data rows
});

test('filters by status so only matching rows show', async ({ page }) => {
  await page.getByLabel('Status').selectOption('failed');
  // Poll until the table reflects the filter (avoids reading mid-fetch).
  await expect
    .poll(async () => {
      const s = await page.locator('tbody tr td:nth-child(6)').allInnerTexts();
      return s.length > 0 && s.every((v) => v === 'failed');
    })
    .toBe(true);
});

test('paginates without repeating rows', async ({ page }) => {
  const firstPageIds = await page.locator('tbody tr td:first-child').allInnerTexts();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('page-indicator')).toContainText('Page 2');
  // Wait for the rows to change before reading page 2 (the re-fetch is async).
  await expect(page.locator('tbody tr td:first-child').first()).not.toHaveText(firstPageIds[0]);
  const secondPageIds = await page.locator('tbody tr td:first-child').allInnerTexts();
  const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
  expect(overlap).toHaveLength(0);
});

test('sorts by amount ascending, numerically', async ({ page }) => {
  await page.getByLabel('Sort by').selectOption('amount');
  await page.getByLabel('Order').selectOption('asc');
  // Poll until the visible amounts are in ascending numeric order.
  await expect
    .poll(async () => {
      const amounts = (await page.locator('tbody tr td:nth-child(3)').allInnerTexts()).map(Number);
      return amounts.every((v, i, arr) => i === 0 || arr[i - 1] <= v);
    })
    .toBe(true);
});

test("an operator sees only their own agent's transactions", async ({ page, context }) => {
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await loginAs(page, OPERATOR.email, OPERATOR.password);
  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(11); // asha (agent 1) has 13 txns -> full page
  const agents = await page.locator('tbody tr td:nth-child(2)').allInnerTexts();
  expect(agents.every((a) => a === '1')).toBe(true);
});
