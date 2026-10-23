import { expect, test } from '@playwright/test';
import { KEY_PAGES, ORIGINS } from './helpers.ts';

// 320 px phones: nothing on a key page may scroll sideways.
test.describe('320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const [site, path] of KEY_PAGES) {
    test(`no sideways scroll: ${site}${path}`, async ({ page }) => {
      await page.goto(ORIGINS[site] + path);
      const [scroll, inner] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  }
});
