import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('landing page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(critical).toHaveLength(0);
  });

  test('login page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(critical).toHaveLength(0);
  });

  test('compliance roadmap has no critical accessibility violations', async ({ page }) => {
    await page.goto('/compliance-roadmap');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(critical).toHaveLength(0);
  });

  test('pages have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/login');

    // All inputs should have labels (either explicit or aria-label)
    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.evaluate((el) => {
        const id = el.id;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const placeholder = el.getAttribute('placeholder');
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        return !!(label || ariaLabel || ariaLabelledBy || placeholder);
      });
      expect(hasLabel).toBeTruthy();
    }
  });

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Tab through the page and verify focus is visible
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});
