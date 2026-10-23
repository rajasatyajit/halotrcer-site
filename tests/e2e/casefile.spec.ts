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

// Review I2: reading pages use reading sizes for h1 and h2, and no heading word is ever split
// across lines on a 320 px phone.
const READING = [
  ['tokvera', '/docs/capture'],
  ['tokvera', '/docs/usage-log-format'],
  ['sievant', '/docs/troubleshooting'],
  ['sievant', '/docs/threat-model'],
  ['www', '/privacy'],
  ['www', '/terms'],
] as const;

test.describe('reading headings at 320 px', () => {
  test.use({ viewport: { width: 320, height: 800 }, isMobile: false, hasTouch: false });
  for (const [site, path] of READING)
    test(`${site}${path}: no heading word breaks`, async ({ page }) => {
      await page.goto(`${ORIGINS[site]}${path}`, { waitUntil: 'networkidle' });
      const res = await page.goto(`${ORIGINS[site]}${path}`, { waitUntil: 'networkidle' });
      expect(res?.status(), 'the page must exist in this build').toBe(200);
      const broken = await page.locator('main :is(h1, h2)').evaluateAll((hs) =>
        hs.flatMap((h) => {
          const out: string[] = [];
          const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
          for (let n; (n = walker.nextNode());) {
            const text = n.textContent ?? '';
            // A break after a hyphen is a normal wrap; anywhere else inside a word is not.
            for (const m of text.matchAll(/[^\s-]+-?/g)) {
              const r = document.createRange();
              r.setStart(n, m.index ?? 0);
              r.setEnd(n, (m.index ?? 0) + m[0].length);
              const tops = new Set([...r.getClientRects()].map((x) => Math.round(x.top)));
              if (tops.size > 1) out.push(m[0]);
            }
          }
          return out;
        }),
      );
      expect(broken).toEqual([]);
    });
});

test.describe('reading heading sizes on desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  for (const [site, path] of READING)
    test(`${site}${path}: h1 ≤ 48 px, h2 ≤ 40 px`, async ({ page }) => {
      const res = await page.goto(`${ORIGINS[site]}${path}`);
      expect(res?.status()).toBe(200);
      const px = (sel: string) =>
        page
          .locator(sel)
          .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
      for (const s of await px('main h1')) expect(s).toBeLessThanOrEqual(48);
      for (const s of await px('main h2')) expect(s).toBeLessThanOrEqual(40);
    });
});

// Review M3: the footer's "simulated demo runs" line sits only on pages that show sample data,
// never under real prices or the visitor's own estimates.
const SMALL = /simulated demo runs on fictional systems/i;
for (const [site, path, shown] of [
  ['www', '/', true],
  ['tokvera', '/sample-report', true],
  ['sievant', '/scan', true],
  ['www', '/pricing', false],
  ['www', '/audit', false],
  ['www', '/calculator', false],
  ['www', '/agencies', false],
] as const)
  test(`footer small print ${shown ? 'on' : 'not on'} ${site}${path}`, async ({ page }) => {
    await page.goto(`${ORIGINS[site]}${path}`);
    const footer = page.locator('footer');
    if (shown) await expect(footer).toContainText(SMALL);
    else await expect(footer).not.toContainText(SMALL);
  });
