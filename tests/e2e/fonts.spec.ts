import { expect, test } from '@playwright/test';
import { ORIGINS } from './helpers.ts';

// The three self-hosted fonts (owner decision 2026-10-23): only Permanent Marker is
// preloaded, nothing loads from another origin, and a late font never moves the layout.
test.describe('fonts on www/', () => {
  test('preloads only Permanent Marker', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/`);
    const preloads = page.locator('link[rel=preload][as=font]');
    await expect(preloads).toHaveCount(1);
    await expect(preloads).toHaveAttribute('href', /permanent-marker/);
    await expect(preloads).toHaveAttribute('crossorigin', /.*/);
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

  test('the fonts are used when they arrive in time', async ({ page }) => {
    await page.goto(`${ORIGINS.www}/`, { waitUntil: 'networkidle' });
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
    });
    expect(loaded).toEqual(expect.arrayContaining(['Case Marker', 'Case Karla']));
  });
});
