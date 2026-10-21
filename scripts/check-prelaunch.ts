// With LAUNCHED=false, no install command, version number, GitHub link or star
// button may appear anywhere in the built output (HTML, XML, text, JSON-LD, JS).
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { builtSites, DIST, Report, walk } from './lib/dist.ts';
import { FORBIDDEN } from './lib/rules.ts';

// Files that are not page content (headers, our own scripts) are still scanned,
// except _headers, whose policy values are not user-visible.
const SKIP = new Set(['_headers']);
const TEXT = /\.(html|xml|txt|json|js|svg|webmanifest|_redirects)$|_redirects$/;

const report = new Report();
if (process.env.LAUNCHED === 'true') {
  console.error('check-prelaunch must run against a LAUNCHED=false build');
  process.exit(2);
}
for (const site of builtSites()) {
  const dir = join(DIST, site);
  for (const file of walk(dir)) {
    const rel = relative(dir, file);
    if (SKIP.has(rel) || !TEXT.test(rel)) continue;
    const text = readFileSync(file, 'utf8');
    for (const [re, what] of FORBIDDEN) {
      const m = re.exec(text);
      if (m) report.error(`${site}/${rel}: ${what}: "${m[0]}"`);
    }
  }
}
report.finish('pre-launch mode (no install commands, versions or GitHub links)');
