import { type Page, type APIRequestContext, expect } from '@playwright/test';

/** Reseed the API to its deterministic baseline so every test starts clean. */
export async function resetData(request: APIRequestContext) {
  await request.post('http://localhost:4000/__test/reset');
}

/**
 * Log in through the UI. We deliberately drive the real form (rather than
 * setting the token directly) so the login flow itself is exercised, and use
 * user-facing locators — the robust way (see the locators lesson).
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

export const ADMIN = { email: 'admin@agentpay.test', password: 'admin123' };
export const OPERATOR = { email: 'asha@agentpay.test', password: 'operator123' }; // agent 1
