import { expect, test } from '@playwright/test';
import { ORIGINS } from './helpers.ts';

const SITES = ['www', 'tokvera', 'sievant'] as const;

for (const javaScriptEnabled of [true, false]) {
  test.describe(`phone header, JS ${javaScriptEnabled ? 'on' : 'off'}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, javaScriptEnabled });
    for (const site of SITES) {
      test(`${site}: Book a call and a Menu that opens`, async ({ page }) => {
        await page.goto(`${ORIGINS[site]}/`);
        const header = page.getByRole('banner');
        await expect(header.getByRole('link', { name: 'Book a call' })).toBeVisible();
        const nav = page.getByRole('navigation', { name: 'Main' });
        const menu = nav.getByText('Menu', { exact: true });
        await expect(menu).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Pricing' })).toBeHidden();
        await menu.click();
        await expect(nav.getByRole('link')).toHaveCount(4);
        await expect(nav.getByRole('link', { name: 'Pricing' })).toBeVisible();
        // The header and the Book a call button stay on one row.
        const book = await header.getByRole('link', { name: 'Book a call' }).boundingBox();
        const mark = await page.locator('.wordmark').boundingBox();
        expect(
          Math.abs(
            (book?.y ?? 0) + (book?.height ?? 0) / 2 - ((mark?.y ?? 0) + (mark?.height ?? 0) / 2),
          ),
        ).toBeLessThan(8);
        if (javaScriptEnabled)
          await expect(nav.getByRole('button', { name: /^Theme/ })).toBeVisible();
      });
    }
  });
}

test.describe('desktop header', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const site of SITES) {
    test(`${site}: four links, no Menu`, async ({ page }) => {
      await page.goto(`${ORIGINS[site]}/`);
      const nav = page.getByRole('navigation', { name: 'Main' });
      await expect(nav.getByText('Menu', { exact: true })).toBeHidden();
      await expect(nav.getByRole('link')).toHaveCount(4);
      for (const link of await nav.getByRole('link').all()) await expect(link).toBeVisible();
      await expect(page.getByRole('button', { name: /^Theme/ })).toBeVisible();
    });
  }
});
