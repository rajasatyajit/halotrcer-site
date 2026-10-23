// The one web font: a Permanent Marker subset (owner decisions 2026-10-23; docs/fonts.md).
// scripts/subset-fonts.ts cuts the file to MARKER_UNICODES; scripts/check-marker.ts fails the
// build if Marker text on any page uses a character outside it; text from the samples that
// falls outside it is set in the body face instead (ClueCard).

// What the built pages of all three hosts set in Marker, both modes
// (`node scripts/check-marker.ts --print`, 2026-10-23).
const USED = "#$&'()+,-./012345679:;?ABCDEFGHIKLMNOPQRSTUVWY[]abcdefghijklmnopqrstuvwxy|—’“”→";
// Agreed extras: digits, A–F (grades), common punctuation, → × % $, the space and the
// no-break space (written as a code point so it stays visible here).
const EXTRA = '0123456789ABCDEF.,:;!?\'"()-–—‘’“”&/…·→×%$ ' + String.fromCodePoint(0xa0);

export const MARKER_CHARS = [...new Set([...USED, ...EXTRA])]
  .sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
  .join('');

export const MARKER_UNICODES = [...MARKER_CHARS]
  .map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`)
  .join(',');

export const inMarkerSubset = (text: string): boolean =>
  [...text].every((c) => MARKER_CHARS.includes(c));
