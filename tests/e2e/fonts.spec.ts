import { expect, test } from '@playwright/test';
import { ORIGINS } from './helpers.ts';

// One self-hosted font, a Permanent Marker subset, not preloaded (owner decisions
// 2026-10-23, LCP budget). Nothing loads from another origin and a late font never moves
// the layout.
test.describe('fonts on www/', () => {
  test('loads only the Marker subset, without a preload', async ({ page }) => {
    const fonts: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'font') fonts.push(r.url());
    });
    await page.goto(`${ORIGINS.www}/`, { waitUntil: 'networkidle' });
    await expect(page.locator('link[rel=preload][as=font]')).toHaveCount(0);
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatch(/\/_astro\/permanent-marker\.[\w-]+\.woff2$/);
  });

  test('a late font causes no layout shift', async ({ page }) => {
    await page.route('**/*.woff2', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    const foreign: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(ORIGINS.www)) foreign.push(r.url());
    });
    await page.goto(`${ORIGINS.www}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const shift = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let sum = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as unknown as { value: number }[]) sum += e.value;
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve(sum), 200);
        }),
    );
    expect(foreign).toEqual([]);
    expect(shift).toBe(0);
  });

  test('Marker is used once cached', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/`, { waitUntil: 'networkidle' });
    await page.goto(`${ORIGINS.www}/`, { waitUntil: 'networkidle' });
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
    });
    expect(loaded).toContain('Case Marker');
    const family = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
    // WebKit serialises the family without quotes; Chromium and Firefox quote it.
    expect(family).toMatch(/^"?Case Marker"?,/);
  });
});
