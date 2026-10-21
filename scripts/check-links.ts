// Internal link check across all built hosts: every same-host or cross-host
// (*.halotrcer.com) link, asset and #fragment must resolve to a built file or a
// redirect. External links are listed, and checked only with --external (M7).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTS, SITES, type SiteId } from '../src/config/site.ts';
import { builtSites, DIST, pages, Report, type Page } from './lib/dist.ts';

const report = new Report();
const built = new Set(builtSites());
const hostToSite = new Map(SITES.map((s) => [HOSTS[s], s] as const));
const pageIndex = new Map<string, Page>();
for (const site of built) for (const p of pages(site)) pageIndex.set(`${site}:${p.rel}`, p);

function redirects(site: SiteId): Set<string> {
  const file = join(DIST, site, '_redirects');
  if (!existsSync(file)) return new Set();
  return new Set(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.split(/\s+/)[0] ?? '')
      .filter(Boolean),
  );
}

// "/" -> index.html, "/audit" -> audit.html, "/robots.txt" -> robots.txt, "/docs" -> docs.html | docs/index.html
function resolve(site: SiteId, path: string): string | undefined {
  const p = decodeURIComponent(path).replace(/^\//, '');
  const candidates = p === '' ? ['index.html'] : [p, `${p}.html`, `${p}/index.html`];
  return candidates.find((c) => existsSync(join(DIST, site, c)));
}

const external = new Set<string>();
let checked = 0;

for (const [, page] of pageIndex) {
  const where = `${page.site}/${page.rel}`;
  const refs = [
    ...page.root.querySelectorAll('a[href]').map((a) => a.getAttribute('href') ?? ''),
    ...page.root.querySelectorAll('link[href]').map((l) => l.getAttribute('href') ?? ''),
    ...page.root.querySelectorAll('script[src], img[src]').map((s) => s.getAttribute('src') ?? ''),
  ];
  for (const ref of refs) {
    if (ref.startsWith('mailto:')) {
      if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]+(\?.*)?$/i.test(ref))
        report.error(`${where}: bad mailto ${ref}`);
      continue;
    }
    const u = new URL(ref, `https://${HOSTS[page.site]}/${page.rel}`);
    const target = hostToSite.get(u.host);
    if (!target) {
      if (u.protocol.startsWith('http')) external.add(u.href);
      continue;
    }
    if (u.protocol !== 'https:') report.error(`${where}: insecure link ${ref}`);
    if (!built.has(target)) continue; // that host isn't in this build
    checked++;
    const file = resolve(target, u.pathname);
    if (!file) {
      if (!redirects(target).has(u.pathname)) report.error(`${where}: broken link ${ref}`);
      continue;
    }
    if (u.hash.length > 1) {
      const id = decodeURIComponent(u.hash.slice(1));
      const dest = pageIndex.get(`${target}:${file}`);
      if (dest && !dest.root.getElementById(id))
        report.error(`${where}: missing #${id} in ${target}/${file}`);
    }
  }
}

console.log(`${checked} internal links checked; ${external.size} external links (checked in M7):`);
for (const e of [...external].sort()) console.log(`  ${e}`);
report.finish('internal links');
