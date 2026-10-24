// Records the built sitemaps' URLs in data/published-urls.json (adds only).
// Run after a pre-launch build, and again after a launched build.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { builtSites, DIST, walk } from './lib/dist.ts';
import { downloadUrls, loadRecorded, record, RECORD_FILE, sitemapUrls } from './lib/permanence.ts';

const mode = process.env.LAUNCHED === 'true' ? 'launched' : 'prelaunch';
const before = loadRecorded();
let next = before;
for (const site of builtSites()) {
  const files = walk(join(DIST, site)).map((f) => relative(join(DIST, site), f));
  const urls = [
    ...sitemapUrls(readFileSync(join(DIST, site, 'sitemap.xml'), 'utf8')),
    ...downloadUrls(site, files),
  ];
  next = record(next, urls, mode);
}
writeFileSync(RECORD_FILE, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  `${RECORD_FILE}: ${Object.keys(next).length} URLs (${Object.keys(next).length - Object.keys(before).length} new, ${mode})`,
);
