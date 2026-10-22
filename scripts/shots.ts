// Redesign screenshots (never committed): every page below at phone and desktop
// width in both colour schemes, full page, from the locally served build.
// Usage: node scripts/shots.ts <before|after>   (SERVE_PORT_BASE and PW_CHROMIUM as for e2e)
// It refuses to run against a server that is not serving this checkout's dist/.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { ORIGINS } from '../tests/e2e/helpers.ts';

type Site = keyof typeof ORIGINS;

const mode = process.argv[2];
if (mode !== 'before' && mode !== 'after') {
  console.error('usage: node scripts/shots.ts <before|after>');
  process.exit(2);
}

const PAGES: [Site, string][] = [
  ['www', '/'],
  ['www', '/audit'],
  ['www', '/pricing'],
  ['www', '/security'],
  ['www', '/about'],
  ['www', '/calculator'],
  ...(existsSync('dist/www/agencies.html') ? [['www', '/agencies'] as [Site, string]] : []),
  ['tokvera', '/'],
  ['tokvera', '/sample-report'],
  ['sievant', '/'],
  ['sievant', '/sample-report'],
  ['sievant', '/scan'],
];
const WIDTHS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

async function assertThisBuild(site: Site): Promise<void> {
  const served = await (await fetch(`${ORIGINS[site]}/`)).text();
  if (served !== readFileSync(join('dist', site, 'index.html'), 'utf8')) {
    console.error(`${ORIGINS[site]} is not serving this checkout's dist/${site}; start it with`);
    console.error('SERVE_PORT_BASE=<free base> node scripts/serve.ts');
    process.exit(1);
  }
}

const out = join('docs', 'redesign', mode);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
let n = 0;
for (const [width, viewport] of Object.entries(WIDTHS)) {
  for (const colorScheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ viewport, colorScheme });
    const page = await context.newPage();
    for (const [site, path] of PAGES) {
      await assertThisBuild(site);
      await page.goto(ORIGINS[site] + path, { waitUntil: 'networkidle' });
      const name = `${site}-${path === '/' ? 'home' : path.slice(1).replaceAll('/', '-')}`;
      await page.screenshot({
        path: join(out, `${name}-${width}-${colorScheme}.jpg`),
        fullPage: true,
        type: 'jpeg',
        quality: 70,
      });
      n++;
    }
    await context.close();
  }
}
await browser.close();
console.log(`${n} screenshots in ${out}`);
