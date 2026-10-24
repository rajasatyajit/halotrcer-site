import { expect, test } from '@playwright/test';
import { CONTACT_EMAIL } from '../../src/config/site.ts';
import { ORIGINS } from './helpers.ts';

// The contact address may wrap only after the @, never inside the local part or the domain,
// wherever it is rendered (contact box, Launching-soon button, footer, prose).
for (const width of [320, 390, 1280])
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: false, hasTouch: false });
    for (const site of ['www', 'tokvera', 'sievant'] as const)
      test(`${site}: the address breaks only after the @`, async ({ page }) => {
        // Twice: the web font is font-display: optional, so only a warm load measures it.
        await page.goto(`${ORIGINS[site]}/`, { waitUntil: 'networkidle' });
        await page.goto(`${ORIGINS[site]}/`, { waitUntil: 'networkidle' });
        const result = await page.evaluate((address) => {
          const at = address.indexOf('@');
          const found: string[] = [];
          const bad: string[] = [];
          // Every element whose own text (across child nodes) contains the address once.
          const holders = [...document.querySelectorAll<HTMLElement>('body *')].filter(
            (el) =>
              el.textContent?.includes(address) &&
              ![...el.children].some((c) => c.textContent?.includes(address)),
          );
          for (const el of holders) {
            if (!el.getClientRects().length) continue; // not rendered (e.g. a closed menu)
            const chars: { c: string; top: number }[] = [];
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n; (n = walker.nextNode());)
              for (let i = 0; i < (n.textContent ?? '').length; i++) {
                const r = document.createRange();
                r.setStart(n, i);
                r.setEnd(n, i + 1);
                const rect = r.getClientRects()[0];
                chars.push({ c: n.textContent?.[i] ?? '', top: rect ? Math.round(rect.top) : -1 });
              }
            const text = chars.map((x) => x.c).join('');
            const start = text.indexOf(address);
            if (start < 0) continue;
            found.push(el.tagName.toLowerCase() + '.' + el.className);
            for (let i = start + 1; i < start + address.length; i++) {
              const prev = chars[i - 1];
              const cur = chars[i];
              if (!prev || !cur || cur.top < 0 || prev.top < 0) continue;
              if (cur.top !== prev.top && i !== start + at + 1)
                bad.push(
                  `${el.className || el.tagName}: breaks before "${address.slice(i - start)}"`,
                );
            }
          }
          return { found, bad };
        }, CONTACT_EMAIL);
        expect(result.found.length).toBeGreaterThan(0);
        expect(result.bad).toEqual([]);
      });
  });
