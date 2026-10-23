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
      for (const b of await page.getByRole('button', { name: 'Copy this case file' }).all())
        await expect(b).toBeHidden();
    });
  });

  test.describe('with JavaScript', () => {
    test.use({ permissions: CLIPBOARD_PERMISSIONS });
    test('Copy this case file copies the summary', async ({ page }) => {
      await recordClipboard(page);
      await page.goto(`${ORIGINS.www}/`);
      await page.getByRole('button', { name: 'Copy this case file' }).first().click();
      await expect.poll(() => copied(page)).toBe(board('www').summary);
    });
  });

  test('Open your case books a call, under the hero and under the board', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/`);
    const open = page.getByRole('link', { name: 'Open your case' });
    await expect(open).toHaveCount(2);
    for (const link of await open.all()) await expect(link).toHaveAttribute('href', /\/book$/);
    await expect(page.getByRole('button', { name: 'Copy this case file' })).toHaveCount(2);
  });

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ])
    test.describe(`${viewport.width} px`, () => {
      test.use({ viewport });
      test('both case buttons sit under the hero line, in the first screen', async ({ page }) => {
        await page.goto(`${ORIGINS.www}/`);
        const lede = await page.locator('.case-hero .lede').boundingBox();
        for (const name of ['Open your case', 'Copy this case file']) {
          const box = await page
            .locator('.case-hero')
            .getByRole(name.startsWith('Open') ? 'link' : 'button', { name })
            .boundingBox();
          expect(box?.y ?? 0).toBeGreaterThan((lede?.y ?? 0) + (lede?.height ?? 0) - 1);
          expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
        }
      });
    });
});
