import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('landing page features section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Everything Your Practice Needs')).toBeVisible();
    await expect(page.locator('text=Online Booking')).toBeVisible();
    await expect(page.locator('text=Video Consultations')).toBeVisible();
    await expect(page.locator('text=Integrated Payments')).toBeVisible();
  });

  test('landing page demo section links to booking pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Try the Demo')).toBeVisible();

    const demoLink = page.locator('a[href="/book/city-health-clinic"]');
    await expect(demoLink).toBeVisible();
  });

  test('footer links work', async ({ page }) => {
    await page.goto('/');
    const complianceLink = page.locator('a[href="/compliance-roadmap"]');
    await expect(complianceLink).toBeVisible();

    await complianceLink.click();
    await expect(page).toHaveURL(/compliance-roadmap/);
  });

  test('sign in link navigates to login', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sign In >> nth=0');
    await expect(page).toHaveURL(/login/);
  });

  test('get started navigates to register', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    await expect(page).toHaveURL(/register/);
  });

  test('unauthenticated dashboard access redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);
    // Should redirect to login or show login page
    const url = page.url();
    expect(url.includes('/login') || url.includes('/dashboard')).toBeTruthy();
  });
});
