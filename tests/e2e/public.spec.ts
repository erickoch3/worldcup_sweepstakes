import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'World Cup Sweepstakes' })).toBeVisible();
});

test('signed-out first access prompts for login and invite-backed account creation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'World Cup Sweepstakes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByText('Use your invite link to create an account.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeHidden();
});

test('sign in button starts Google OAuth', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Sign in with Google' }).click();

  await expect(page).toHaveURL(/accounts\.google\.com/);
});

test('login page explains invite-required account creation errors', async ({ page }) => {
  await page.goto('/login?error=OAuthCreateAccount&callbackUrl=%2F');

  await expect(page.getByText('Use your invite link to create an account before signing in.')).toBeVisible();
});

test('stylesheet asset is served by the production bundle', async ({ page, request }) => {
  await page.goto('/');

  const stylesheetHref = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');

  expect(stylesheetHref).toBeTruthy();

  const stylesheetUrl = new URL(stylesheetHref as string, page.url()).toString();
  const stylesheetResponse = await request.get(stylesheetUrl);

  expect(stylesheetResponse.ok()).toBe(true);
});

test('signed-out schedule page prompts for login', async ({ page }) => {
  await page.goto('/schedule');

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeHidden();
});

test('signed-out bracket page prompts for login', async ({ page }) => {
  await page.goto('/bracket');

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bracket' })).toBeHidden();
});
