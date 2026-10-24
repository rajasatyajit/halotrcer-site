// WCAG 2.2 AA (axe) on every key page in both colour schemes, with the real CSP
// applied, plus no-JS rendering and keyboard basics.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { KEY_PAGES, ORIGINS, watchErrors } from './helpers.ts';

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.use({ colorScheme: scheme });
    for (const [site, path] of KEY_PAGES) {
      test(`axe: ${site}${path}`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(ORIGINS[site] + path);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
          .analyze();
        expect(
          results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`),
        ).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  });
}

test('explicit dark theme from the toggle persists across pages', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(ORIGINS.www + '/');
  // On phones the toggle sits in the header menu.
  const menu = page.getByRole('navigation', { name: 'Main' }).getByText('Menu', { exact: true });
  if (await menu.isVisible()) await menu.click();
  const toggle = page.getByRole('button', { name: /^Theme/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto(ORIGINS.www + '/pricing');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('skip link is the first tab stop and moves focus to main', async ({ page }) => {
  await page.goto(ORIGINS.www + '/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const [site, path] of KEY_PAGES) {
    test(`renders: ${site}${path}`, async ({ page }) => {
      await page.goto(ORIGINS[site] + path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('main')).not.toBeEmpty();
      // The theme toggle needs JS: it must not be shown as a dead control.
      // (Two copies: the header's and, on phones, the menu's.)
      for (const toggle of await page.locator('[data-theme-toggle]').all())
        await expect(toggle).toBeHidden();
    });
  }
});
