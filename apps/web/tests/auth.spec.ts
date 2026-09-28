import { test, expect } from '@playwright/test';
import { ADMIN, loginAs, resetData } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await resetData(request);
});

test('signs in with valid credentials and lands on the dashboard', async ({ page }) => {
  await loginAs(page, ADMIN.email, ADMIN.password);
  await expect(page.getByTestId('current-user')).toContainText('admin');
});

test('shows an error for a wrong password and stays on login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid email or password');
  await expect(page).toHaveURL(/\/login$/);
});

test('redirects an unauthenticated visitor to login', async ({ page }) => {
  await page.goto('/transactions');
  await expect(page).toHaveURL(/\/login$/);
});

test('logs out and blocks the protected pages again', async ({ page }) => {
  await loginAs(page, ADMIN.email, ADMIN.password);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
