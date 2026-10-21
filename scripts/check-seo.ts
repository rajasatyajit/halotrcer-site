// SEO basics on every built page: lang, one <h1>, a title and description, a
// canonical URL on the page's own host matching og:url, titles and descriptions
// unique across all three hosts, and noindex on exactly the allowlisted pages.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTS } from '../src/config/site.ts';
import { canonicalPath } from '../src/lib/paths.ts';
import { ogImagePath } from '../src/lib/og.ts';
import { builtSites, DIST, pages, Report } from './lib/dist.ts';

// 404 pages, and /book while it is the fallback page (keep in sync with lighthouserc.cjs).
const NOINDEX = /^(404|book)\.html$/;

const report = new Report();
const titles = new Map<string, string>();
const descriptions = new Map<string, string>();

const indexable = new Map(builtSites().map((s) => [s, new Set<string>()]));

for (const site of builtSites()) {
  for (const page of pages(site)) {
    const where = `${site}/${page.rel}`;
    const r = page.root;
    const h1s = r.querySelectorAll('h1').length;
    if (h1s !== 1) report.error(`${where}: ${h1s} <h1> elements (want exactly 1)`);
    if (!r.querySelector('html')?.getAttribute('lang'))
      report.error(`${where}: <html> has no lang`);
    const title = r.querySelector('title')?.textContent.trim() ?? '';
    const desc = r.querySelector('meta[name=description]')?.getAttribute('content')?.trim() ?? '';
    if (!title) report.error(`${where}: no <title>`);
    if (title.length > 70) report.error(`${where}: title is ${title.length} chars (max 70)`);
    if (desc.length < 50 || desc.length > 200) {
      report.error(`${where}: description is ${desc.length} chars (want 50-200)`);
    }
    const canonical = r.querySelector('link[rel=canonical]')?.getAttribute('href') ?? '';
    if (!canonical.startsWith(`https://${HOSTS[site]}/`)) {
      report.error(`${where}: canonical "${canonical}" is not on https://${HOSTS[site]}/`);
    }
    const og = r.querySelector('meta[property="og:url"]')?.getAttribute('content');
    if (og !== canonical) report.error(`${where}: og:url "${og}" differs from canonical`);
    const noindex = /noindex/.test(
      r.querySelector('meta[name=robots]')?.getAttribute('content') ?? '',
    );
    // Only these pages may be noindex, and they must be (Lighthouse skips SEO on
    // them), plus blog posts that are still outlines (DraftNotice outline).
    const mustNoindex = NOINDEX.test(page.rel) || r.querySelector('[data-draft-post]') !== null;
    if (noindex !== mustNoindex) {
      report.error(`${where}: ${noindex ? 'unexpected noindex' : 'should be noindex'}`);
    }
    if (noindex) continue;
    indexable.get(site)?.add(canonical);
    // Open Graph image: present, a PNG of 1200x630.
    const ogFile = join(DIST, site, ogImagePath(canonicalPath(new URL(canonical).pathname)));
    if (!existsSync(ogFile)) report.error(`${where}: missing Open Graph image ${ogFile}`);
    else {
      const png = readFileSync(ogFile);
      if (png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630)
        report.error(`${where}: OG image is not 1200x630`);
    }
    for (const [map, value, what] of [
      [titles, title, 'title'],
      [descriptions, desc, 'description'],
    ] as const) {
      const prev = map.get(value);
      if (prev) report.error(`${where}: duplicate ${what} (also on ${prev})`);
      else map.set(value, where);
    }
  }
}

// sitemap.xml lists exactly the indexable pages; robots.txt points at it; llms.txt exists.
for (const site of builtSites()) {
  const read = (f: string) =>
    existsSync(join(DIST, site, f)) ? readFileSync(join(DIST, site, f), 'utf8') : '';
  const listed = new Set(
    [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] ?? ''),
  );
  const want = indexable.get(site) ?? new Set();
  for (const u of want) if (!listed.has(u)) report.error(`${site}: sitemap.xml lacks ${u}`);
  for (const u of listed)
    if (!want.has(u))
      report.error(`${site}: sitemap.xml lists ${u}, which is not an indexable page`);
  if (!read('robots.txt').includes(`Sitemap: https://${HOSTS[site]}/sitemap.xml`)) {
    report.error(`${site}: robots.txt does not point at sitemap.xml`);
  }
  if (!read('llms.txt').startsWith('# ')) report.error(`${site}: llms.txt missing or not Markdown`);
  if (site === 'www' && !read('sitemap-index.xml').includes('<sitemapindex'))
    report.error('www: sitemap-index.xml missing');
}

report.finish('SEO basics');
