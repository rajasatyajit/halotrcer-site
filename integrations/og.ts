// Renders one Open Graph PNG per built page (dist/<site>/og/<path>.png) from
// the page's <title> and meta description, and the www logo (logo.png).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { parse } from 'node-html-parser';
import type { Flags } from '../src/config/flags.ts';
import { SITE_NAMES } from '../src/config/site.ts';
import { canonicalPath } from '../src/lib/paths.ts';
import { ogImagePath, ogSvg } from '../src/lib/og.ts';
import { faviconSvg } from '../src/lib/favicon.ts';
import { formatPrice, loadPricing } from '../src/lib/pricing.ts';

const require = createRequire(import.meta.url);
const fontDir = join(dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const fontFiles = [join(fontDir, 'DejaVuSans.ttf'), join(fontDir, 'DejaVuSans-Bold.ttf')];

const render = (svg: string, width: number) =>
  new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' },
  })
    .render()
    .asPng();

export function renderOgImages(out: string, htmlFiles: string[], flags: Flags): number {
  let n = 0;
  for (const file of htmlFiles) {
    const root = parse(readFileSync(file, 'utf8'));
    if (/noindex/.test(root.querySelector('meta[name=robots]')?.getAttribute('content') ?? ''))
      continue;
    const title = root.querySelector('title')?.textContent.split(' · ')[0] ?? '';
    const description = root.querySelector('meta[name=description]')?.getAttribute('content') ?? '';
    const body = root.querySelector('body');
    const stamp = body?.getAttribute('data-og-stamp') || undefined;
    const prices =
      body?.getAttribute('data-og-template') === 'pricing'
        ? loadPricing().services.map((s) => ({
            name: s.name,
            label: `From ${formatPrice(s.from)}`,
          }))
        : undefined;
    const target = join(out, ogImagePath(canonicalPath(`/${relative(out, file)}`)));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      render(
        ogSvg({
          site: flags.site,
          siteName: SITE_NAMES[flags.site],
          title,
          description,
          stamp,
          prices,
        }),
        1200,
      ),
    );
    n++;
  }
  if (flags.site === 'www') writeFileSync(join(out, 'logo.png'), render(faviconSvg('www'), 512));
  return n;
}
