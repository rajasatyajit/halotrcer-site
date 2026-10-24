import { expect, test } from '@playwright/test';
import { ORIGINS } from './helpers.ts';

// Dark text blocks (README and terminal output) wrap: no line is cut off by a hidden or
// scrolling overflow, at phone and desktop widths.
const PAGES = [
  ['www', '/'],
  ['tokvera', '/'],
  ['sievant', '/'],
  ['sievant', '/scan'],
] as const;

for (const width of [320, 390, 1280])
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: false, hasTouch: false });
    for (const [site, path] of PAGES)
      test(`${site}${path}: no text block hides overflow`, async ({ page }) => {
        await page.goto(`${ORIGINS[site]}${path}`, { waitUntil: 'networkidle' });
        await page.goto(`${ORIGINS[site]}${path}`, { waitUntil: 'networkidle' });
        const clipped = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('.terminal, .terminal *, pre, pre *')]
            .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
            .map((el) => `${el.className || el.tagName}: ${(el.textContent ?? '').slice(0, 50)}`),
        );
        expect(clipped).toEqual([]);
      });
  });

// On desktop a terminal block uses the full content width, not half of a two-column split.
test.describe('terminal width on desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  for (const site of ['tokvera', 'sievant'] as const)
    test(`${site}: terminals as wide as their section`, async ({ page }) => {
      await page.goto(`${ORIGINS[site]}/`);
      const ratios = await page.locator('.terminal').evaluateAll((els) =>
        els.map((el) => {
          const section = el.closest('section');
          const inner = section
            ? section.clientWidth -
              parseFloat(getComputedStyle(section).paddingLeft) -
              parseFloat(getComputedStyle(section).paddingRight)
            : 1;
          return Math.round((el.getBoundingClientRect().width / inner) * 100);
        }),
      );
      expect(ratios.length).toBeGreaterThan(0);
      for (const r of ratios) expect(r).toBeGreaterThanOrEqual(95);
    });
});
