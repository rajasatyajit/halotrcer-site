// External links on every built page, checked over the network (nightly in CI,
// .github/workflows/external-links.yml). Broken links fail; sites that turn
// away automated requests are listed as unverified.
import { builtSites, pages, Report } from './lib/dist.ts';
import { HOSTS } from '../src/config/site.ts';
import { skipped, verdict } from './lib/external.ts';

const launched = process.env.LAUNCHED === 'true';
const ours = new Set(Object.values(HOSTS));
const links = new Map<string, string>(); // href -> first page that links it

for (const site of builtSites()) {
  for (const page of pages(site)) {
    for (const a of page.root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      if (!/^https?:\/\//.test(href)) continue;
      const u = new URL(href);
      if (ours.has(u.host) || skipped(href, launched)) continue;
      u.hash = '';
      if (!links.has(u.href)) links.set(u.href, `${site}/${page.rel}`);
    }
  }
}

async function status(href: string): Promise<number | undefined> {
  for (const method of ['HEAD', 'GET']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(href, {
          method,
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
          headers: { 'User-Agent': 'halotrcer-site link check (+https://www.halotrcer.com)' },
        });
        await res.body?.cancel();
        // Some servers refuse HEAD; try GET before judging.
        if (method === 'HEAD' && [403, 404, 405, 501].includes(res.status)) break;
        if (res.status >= 500 && attempt === 0) continue;
        return res.status;
      } catch {
        if (attempt === 1 && method === 'GET') return undefined;
      }
    }
  }
  return undefined;
}

const report = new Report();
const queue = [...links.keys()].sort();
const unverified: string[] = [];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let href = queue.shift(); href; href = queue.shift()) {
      const s = await status(href);
      const v = verdict(s);
      if (v === 'broken')
        report.error(`${href} (${s ?? 'no response'}), linked from ${links.get(href)}`);
      if (v === 'unverified') unverified.push(`${href} (${s})`);
    }
  }),
);
console.log(`${links.size} external links checked.`);
if (unverified.length) {
  console.log('Unverified (the site turns away automated requests):');
  for (const u of unverified.sort()) console.log(`  ${u}`);
}
report.finish('external links');
