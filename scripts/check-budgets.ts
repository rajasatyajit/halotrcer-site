// Per-page budgets from dist: gzipped JS <= 20 KB, page weight (gzipped text
// assets + binary assets) <= 250 KB, CSS <= 20 KB gzipped, no font files, and
// no built module that imports another.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { builtSites, DIST, pages, Report, walk } from './lib/dist.ts';

export const BUDGET = { js: 20 * 1024, css: 20 * 1024, page: 250 * 1024 };
// Static or dynamic import of a relative module in minified output.
const CHAINED = /\b(?:from|import)\s*\(?\s*["'`]\.{1,2}\//;
const TEXT = /\.(html|css|js|svg|json|txt|xml)$/;

const gz = (buf: Buffer) => gzipSync(buf, { level: 9 }).length;
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

const report = new Report();
const rows: string[][] = [];

for (const site of builtSites()) {
  const dir = join(DIST, site);
  for (const f of walk(dir)) {
    if (/\.(woff2?|ttf|otf|eot)$/.test(f)) report.error(`${site}: font file shipped: ${f}`);
    // One request per island: an import between built modules is a chained
    // request (it delays LCP, and the JS budget below counts only the entry).
    if (/[/\\]_astro[/\\][^/\\]+\.js$/.test(f) && CHAINED.test(readFileSync(f, 'utf8')))
      report.error(`${site}: ${f} imports another module (a chained request)`);
  }
  for (const page of pages(site)) {
    const size = (ref: string) => {
      const file = join(dir, ref.split(/[?#]/)[0] ?? '');
      if (!ref.startsWith('/') || !existsSync(file)) return 0;
      const buf = readFileSync(file);
      return TEXT.test(file) ? gz(buf) : buf.length;
    };
    const scripts = page.root
      .querySelectorAll('script[src]')
      .map((s) => s.getAttribute('src') ?? '');
    const styles = page.root
      .querySelectorAll('link[rel=stylesheet]')
      .map((l) => l.getAttribute('href') ?? '');
    const other = [
      ...page.root
        .querySelectorAll('link[rel=icon], link[rel=modulepreload]')
        .map((l) => l.getAttribute('href') ?? ''),
      ...page.root.querySelectorAll('img[src]').map((i) => i.getAttribute('src') ?? ''),
    ];
    const js = scripts.reduce((n, s) => n + size(s), 0);
    const css = styles.reduce((n, s) => n + size(s), 0);
    const total = gz(readFileSync(page.file)) + js + css + other.reduce((n, s) => n + size(s), 0);
    rows.push([`${site}/${page.rel}`, kb(js), kb(css), kb(total)]);
    if (js > BUDGET.js) report.error(`${site}/${page.rel}: JS ${kb(js)} > ${kb(BUDGET.js)}`);
    if (css > BUDGET.css) report.error(`${site}/${page.rel}: CSS ${kb(css)} > ${kb(BUDGET.css)}`);
    if (total > BUDGET.page)
      report.error(`${site}/${page.rel}: page ${kb(total)} > ${kb(BUDGET.page)}`);
  }
}

console.log(['page', 'js (gz)', 'css (gz)', 'total'].join('\t'));
for (const r of rows) console.log(r.join('\t'));
report.finish('budgets');
