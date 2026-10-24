import { expect, test } from '@playwright/test';
import { url } from '../../src/config/site.ts';
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

// The product heroes no longer link to the sample report: on the smallest phone it must be
// one tap away once the header menu is open.
test.describe('sample report from the header at 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: false, hasTouch: false });
  for (const site of ['tokvera', 'sievant'] as const)
    test(`${site}: Menu, then Sample report`, async ({ page }) => {
      await page.goto(`${ORIGINS[site]}/`);
      const nav = page.getByRole('navigation', { name: 'Main' });
      await nav.getByText('Menu', { exact: true }).click();
      const link = nav.getByRole('link', { name: 'Sample report' });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(640);
      // Links carry the production URL (url() in src/config/site.ts).
      await expect(link).toHaveAttribute('href', url(site, '/sample-report'));
    });
});

// Both theme buttons (header and phone menu) describe the same next action after every switch.
test.describe('theme toggle labels', () => {
  test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  test('switching in the header relabels the menu copy too, and back', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/`);
    const labels = () =>
      page
        .locator('[data-theme-toggle]')
        .evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')));
    expect(await labels()).toEqual(['Theme: switch to dark', 'Theme: switch to dark']);
    await page.locator('.site-header__theme').click();
    expect(await labels()).toEqual(['Theme: switch to light', 'Theme: switch to light']);
    await page.locator('.site-header__theme').click();
    expect(await labels()).toEqual(['Theme: switch to dark', 'Theme: switch to dark']);
  });
});
