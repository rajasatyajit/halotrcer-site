// The one web font: a Permanent Marker subset (owner decisions 2026-10-23; docs/fonts.md).
// scripts/subset-fonts.ts cuts the file to MARKER_UNICODES; text from the samples that
// falls outside it is set in the body face instead (ClueCard).

// Printable ASCII plus the punctuation the copy uses: · × – — ‘ ’ “ ” … →
export const MARKER_UNICODES =
  'U+0020-007E,U+00B7,U+00D7,U+2013-2014,U+2018-2019,U+201C-201D,U+2026,U+2192';

const RANGES = MARKER_UNICODES.split(',').map((r) => {
  const [lo, hi = lo] = r.replace(/U\+/g, '').split('-');
  return [parseInt(lo ?? '0', 16), parseInt(hi ?? '0', 16)] as const;
});

export const inMarkerSubset = (text: string): boolean =>
  [...text].every((c) => {
    const cp = c.codePointAt(0) ?? 0;
    return RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
  });
