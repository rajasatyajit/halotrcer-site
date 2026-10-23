import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ORIGINS } from './helpers.ts';

// Task 10: sample reports as case files (paper sheets on wood, each stamped), the Sievant
// sample download, and docs, blog and legal pages on paper.
const WOOD = 'rgb(59, 42, 26)';
const marker = (family: string) => family.startsWith('"Case Marker"');

for (const site of ['tokvera', 'sievant'] as const)
  test.describe(`${site} sample report`, () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('paper sheets on wood, every sheet stamped', async ({ page }) => {
      await page.goto(`${ORIGINS[site]}/sample-report`);
      expect(await page.locator('main').evaluate((m) => getComputedStyle(m).backgroundColor)).toBe(
        WOOD,
      );
      const sheets = page.locator('main section.sheet');
      expect(await sheets.count()).toBeGreaterThanOrEqual(site === 'tokvera' ? 3 : 3);
      for (const sheet of await sheets.all())
        await expect(sheet.locator('[data-stamp]').first()).toBeAttached();
      // Every report section is a sheet.
      expect(
        await page
          .locator('[data-sample] > section:not(.sheet), [data-sample] section.section:not(.sheet)')
          .count(),
      ).toBe(0);
    });
  });

test('sievant sample report: the labelled JSON download is the committed sample', async ({
  page,
  request,
}) => {
  await page.goto(`${ORIGINS.sievant}/sample-report`);
  const link = page.getByRole('link', { name: /Download this sample \(JSON\)/ });
  await expect(link).toHaveAttribute('href', '/samples/sievant-posture.simulated-demo.json');
  const res = await request.get(`${ORIGINS.sievant}/samples/sievant-posture.simulated-demo.json`);
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual(
    JSON.parse(readFileSync('content/samples/sievant-posture.json', 'utf8')),
  );
});

for (const [site, path] of [
  ['tokvera', '/docs/scan'],
  ['sievant', '/docs/scan-and-wrap'],
  ['www', '/blog/what-an-mcp-config-scan-looks-for'],
  ['www', '/privacy'],
  ['www', '/terms'],
  ['www', '/about'],
] as const)
  test(`${site}${path}: paper body, Marker only for h1 and h2`, async ({ page }) => {
    await page.goto(`${ORIGINS[site]}${path}`);
    const main = page.locator('main');
    await expect(main).toHaveClass(/paper-main/);
    expect(
      marker(
        await main
          .locator('h1')
          .first()
          .evaluate((h) => getComputedStyle(h).fontFamily),
      ),
    ).toBe(true);
    for (const h of await main.locator('h3, h4').all())
      expect(marker(await h.evaluate((el) => getComputedStyle(el).fontFamily))).toBe(false);
  });

test('clue source lines read "Source: <tool> sample report"', async ({ page }) => {
  await page.goto(`${ORIGINS.www}/`);
  const lines = await page.locator('.clue__source').allTextContents();
  expect(lines).toHaveLength(6);
  for (const l of lines)
    expect(l.replace(/\s+/g, ' ').trim()).toMatch(
      /^Source: (Tokvera|Sievant) sample report( · p99)?$/,
    );
});

// Boxes that sit on the wood but have their own light or dark ground (source notes) keep
// readable text in both themes.
for (const colorScheme of ['light', 'dark'] as const)
  for (const site of ['tokvera', 'sievant'] as const)
    test(`${site} sample report, ${colorScheme}: notes on the wood are readable`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ colorScheme });
      const page = await context.newPage();
      await page.goto(`${ORIGINS[site]}/sample-report`);
      const ratios = await page.locator('.wood-main .note').evaluateAll((els) => {
        const lum = (rgb: string) => {
          const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? [])
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              const c = v / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            }) as [number, number, number];
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        return els.map((el) => {
          const cs = getComputedStyle(el);
          const [hi, lo] = [lum(cs.color), lum(cs.backgroundColor)].sort((a, b) => b - a) as [
            number,
            number,
          ];
          return (hi + 0.05) / (lo + 0.05);
        });
      });
      expect(ratios.length).toBeGreaterThan(0);
      for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5);
      await context.close();
    });
