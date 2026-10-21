// SEO basics on every built page: lang, one <h1>, a title and description, a
// canonical URL on the page's own host matching og:url, titles and descriptions
// unique across all three hosts, and noindex on exactly the allowlisted pages.
import { HOSTS } from '../src/config/site.ts';
import { builtSites, pages, Report } from './lib/dist.ts';

// 404 pages, and /book while it is the fallback page (keep in sync with lighthouserc.cjs).
const NOINDEX = /^(404|book)\.html$/;

const report = new Report();
const titles = new Map<string, string>();
const descriptions = new Map<string, string>();

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
    // Only these pages may be noindex, and they must be (Lighthouse skips SEO on them).
    const mustNoindex = NOINDEX.test(page.rel);
    if (noindex !== mustNoindex) {
      report.error(`${where}: ${noindex ? 'unexpected noindex' : 'should be noindex'}`);
    }
    if (noindex) continue;
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

report.finish('SEO basics');
