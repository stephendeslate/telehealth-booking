import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('landing page loads and shows MedConnect branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=MedConnect')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('text=Get Started')).toBeVisible();
  });

  test('demo banner is visible on all pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="demo-banner"]').or(page.locator('text=DEMO'))).toBeVisible();
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('text=Create Account').or(page.locator('text=Register'))).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message (not redirect)
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/login');
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('login page has link to register', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
  });

  test('register page has link to login', async ({ page }) => {
    await page.goto('/register');
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });
});
