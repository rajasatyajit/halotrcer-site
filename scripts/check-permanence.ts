// Fails when a recorded published URL disappears without a redirect, or when a
// sitemap URL has not been recorded yet (scripts/lib/permanence.ts).
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { builtSites, DIST, Report, walk } from './lib/dist.ts';
import {
  downloadUrls,
  loadRecorded,
  problems,
  redirectSources,
  sitemapUrls,
} from './lib/permanence.ts';

const mode = process.env.LAUNCHED === 'true' ? 'launched' : 'prelaunch';
const builds = builtSites().map((site) => ({
  site,
  // Sitemap pages plus the published downloads (samples/*.json).
  sitemap: [
    ...sitemapUrls(readFileSync(join(DIST, site, 'sitemap.xml'), 'utf8')),
    ...downloadUrls(
      site,
      walk(join(DIST, site)).map((f) => relative(join(DIST, site), f)),
    ),
  ],
  redirects: redirectSources(readFileSync(join(DIST, site, '_redirects'), 'utf8')),
}));
const report = new Report();
for (const p of problems(loadRecorded(), builds, mode)) report.error(p);
report.finish(`URL permanence (${mode})`);
