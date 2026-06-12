import { expect, test } from '@playwright/test';

test('admin route does not render management UI for signed-out users', async ({ page }) => {
  await page.goto('/admin');

  await expect(page.getByRole('link', { name: 'Invites' })).toBeHidden();
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin$/);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});
