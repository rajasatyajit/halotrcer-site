import { expect, test } from '@playwright/test';
import { board } from '../../src/lib/clues.ts';
import { CLIPBOARD_PERMISSIONS, copied, ORIGINS, recordClipboard } from './helpers.ts';

const region = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: /detective board/i });

test.describe('www board', () => {
  test('six stamped clue cards around the subject, in a list', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/`);
    const list = region(page).getByRole('list').first();
    await expect(list.locator(':scope > li')).toHaveCount(9);
    const cards = list.locator('article[data-clue]');
    await expect(cards).toHaveCount(6);
    for (const card of await cards.all()) await expect(card).toContainText('Simulated demo run');
    await expect(region(page)).toContainText('Your AI');
  });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } });
    test('shows the yarn and tilts the cards', async ({ page }) => {
      await page.goto(`${ORIGINS.www}/`);
      await expect(page.locator('.yarn')).toBeVisible();
      const t = await page
        .locator('.clue')
        .first()
        .evaluate((el) => getComputedStyle(el).transform);
      expect(t).not.toBe('none');
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('one column, no yarn, straight cards', async ({ page }) => {
      await page.goto(`${ORIGINS.www}/`);
      await expect(page.locator('.yarn')).toBeHidden();
      const xs = await page
        .locator('.clue')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
      expect(new Set(xs).size).toBe(1);
      const t = await page
        .locator('.clue')
        .first()
        .evaluate((el) => getComputedStyle(el).transform);
      expect(t).toBe('none');
    });
  });

  test.describe('reduced motion', () => {
    test.use({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    test('no tilt', async ({ page }) => {
      await page.goto(`${ORIGINS.www}/`);
      const ts = await page
        .locator('.clue')
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
      expect(new Set(ts)).toEqual(new Set(['none']));
    });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('the case file text is visible and the copy buttons are hidden', async ({ page }) => {
      await page.goto(`${ORIGINS.www}/`);
      await expect(page.locator('#case-file-text')).toHaveText(board('www').summary);
      await expect(page.getByRole('button', { name: 'Copy this case file' })).toBeHidden();
    });
  });

  test.describe('with JavaScript', () => {
    test.use({ permissions: CLIPBOARD_PERMISSIONS });
    test('Copy this case file copies the summary', async ({ page }) => {
      await recordClipboard(page);
      await page.goto(`${ORIGINS.www}/`);
      await page.getByRole('button', { name: 'Copy this case file' }).click();
      await expect.poll(() => copied(page)).toBe(board('www').summary);
    });
  });

  test('Open your case books a call', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/`);
    await expect(page.getByRole('link', { name: 'Open your case' })).toHaveAttribute(
      'href',
      /\/book$/,
    );
  });
});
