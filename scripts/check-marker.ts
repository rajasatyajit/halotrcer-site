// Every character set in Permanent Marker on a built page is in the font subset
// (MARKER_CHARS, src/lib/fonts.ts); otherwise it would render in the fallback face.
// Usage: node scripts/check-marker.ts            check dist
//        node scripts/check-marker.ts --print    print the characters dist sets in Marker
// To add glyphs: npm run font:marker (re-collects them from both modes and re-cuts the font).
import { MARKER_CHARS } from '../src/lib/fonts.ts';
import { Report } from './lib/dist.ts';
import { distMarkerChars, markerFailure, missingGlyphs } from './lib/marker.ts';

const report = new Report();
const all = new Set<string>();
for (const { site, rel, chars } of distMarkerChars()) {
  for (const c of chars) all.add(c);
  const missing = missingGlyphs(chars, MARKER_CHARS);
  if (missing.length) report.error(`${site}/${rel}: ${markerFailure(missing)}`);
}
if (process.argv.includes('--print'))
  console.log(
    JSON.stringify(
      [...all]
        .filter((c) => c.trim())
        .sort()
        .join(''),
    ),
  );
report.finish('marker glyphs (Marker text stays inside the font subset)');
