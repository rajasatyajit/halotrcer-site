// Every character set in Permanent Marker on a built page is in the font subset
// (MARKER_CHARS, src/lib/fonts.ts); otherwise it would render in the fallback face.
// Usage: node scripts/check-marker.ts            check dist
//        node scripts/check-marker.ts --print    print the characters dist sets in Marker
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKER_CHARS } from '../src/lib/fonts.ts';
import { builtSites, DIST, pages, Report, walk } from './lib/dist.ts';
import { markerChars, markerRules, missingGlyphs } from './lib/marker.ts';

const print = process.argv.includes('--print');
const report = new Report();
const all = new Set<string>();

for (const site of builtSites()) {
  const css = walk(join(DIST, site))
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const rules = markerRules(css);
  if (rules.marker.length === 0) report.error(`${site}: no Marker rules found in the built CSS`);
  for (const page of pages(site)) {
    const chars = markerChars(page.root, rules);
    for (const c of chars) all.add(c);
    const missing = missingGlyphs(chars, MARKER_CHARS);
    if (missing.length)
      report.error(
        `${site}/${page.rel}: Marker text uses glyphs outside the subset: ${missing.join(' ')}`,
      );
  }
}

if (print)
  console.log(
    JSON.stringify(
      [...all]
        .filter((c) => c.trim())
        .sort()
        .join(''),
    ),
  );
report.finish('marker glyphs (Marker text stays inside the font subset)');
