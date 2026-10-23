import { expect, test } from '@playwright/test';
import { KEY_PAGES, ORIGINS } from './helpers.ts';

// 320 px phones: nothing on a key page may scroll sideways.
test.describe('320 px', () => {
  // Not isMobile: mobile emulation widens the layout viewport to fit overflowing content,
  // which would hide exactly the sideways scroll this test looks for.
  test.use({ viewport: { width: 320, height: 640 }, isMobile: false, hasTouch: false });
  for (const [site, path] of KEY_PAGES) {
    test(`no sideways scroll: ${site}${path}`, async ({ page }) => {
      // Twice: the fonts are font-display: optional, so only a warm load measures them.
      await page.goto(ORIGINS[site] + path, { waitUntil: 'networkidle' });
      await page.goto(ORIGINS[site] + path, { waitUntil: 'networkidle' });
      const [scroll, inner] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  }
});
