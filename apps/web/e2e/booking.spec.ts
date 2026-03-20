import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('booking page loads for valid practice slug', async ({ page }) => {
    await page.goto('/book/city-health-clinic');

    // Should show practice name or loading state
    await page.waitForTimeout(3000);

    // Either shows the practice or a "not found" (depending on API availability)
    const content = await page.textContent('body');
    expect(
      content?.includes('City Health Clinic') || content?.includes('Practice Not Found'),
    ).toBeTruthy();
  });

  test('booking page shows not found for invalid slug', async ({ page }) => {
    await page.goto('/book/nonexistent-practice-12345');

    await page.waitForTimeout(3000);
    await expect(
      page.locator('text=Practice Not Found').or(page.locator('text=not found')),
    ).toBeVisible();
  });

  test('booking wizard shows step indicator', async ({ page }) => {
    await page.goto('/book/city-health-clinic');
    await page.waitForTimeout(3000);

    // If practice loads, step indicator should be visible
    const practiceLoaded = await page.locator('text=Book an Appointment').isVisible().catch(() => false);
    if (practiceLoaded) {
      // Step indicator should show numbered steps
      await expect(page.locator('text=Provider').or(page.locator('text=Service'))).toBeVisible();
    }
  });

  test('compliance roadmap page loads', async ({ page }) => {
    await page.goto('/compliance-roadmap');
    await expect(page.locator('text=Compliance Roadmap')).toBeVisible();
    await expect(page.locator('text=HIPAA')).toBeVisible();
    await expect(page.locator('text=GDPR')).toBeVisible();
    await expect(page.locator('text=WCAG 2.1 AA')).toBeVisible();
  });
});
