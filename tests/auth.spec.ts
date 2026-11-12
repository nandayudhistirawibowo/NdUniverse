import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('logs in with the dummy student account and opens the German dashboard', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard-de(?:\/|$)/);
});

test('logs out back to the German login page', async ({ page }) => {
  await login(page);
  await page.locator('summary.account-trigger').click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/login-de(?:$|[?#])/);
});
