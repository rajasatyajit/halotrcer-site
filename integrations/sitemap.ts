// Per-host sitemap.xml from the built pages' canonical URLs (noindex pages
// left out), and on www a sitemap index naming all three hosts' sitemaps.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import type { Flags } from '../src/config/flags.ts';
import { SITES, url } from '../src/config/site.ts';

const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function writeSitemaps(out: string, htmlFiles: string[], flags: Flags): number {
  const urls = htmlFiles
    .map((f) => parse(readFileSync(f, 'utf8')))
    .filter(
      (r) => !/noindex/.test(r.querySelector('meta[name=robots]')?.getAttribute('content') ?? ''),
    )
    .map((r) => r.querySelector('link[rel=canonical]')?.getAttribute('href'))
    .filter((u): u is string => Boolean(u))
    .sort();
  const body = urls.map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`).join('\n');
  writeFileSync(
    join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
  );
  if (flags.site === 'www') {
    const index = SITES.map(
      (s) => `  <sitemap><loc>${url(s, '/sitemap.xml')}</loc></sitemap>`,
    ).join('\n');
    writeFileSync(
      join(out, 'sitemap-index.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${index}\n</sitemapindex>\n`,
    );
  }
  return urls.length;
}
