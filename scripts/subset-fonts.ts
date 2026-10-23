// One-off: subset the three Case File fonts to Latin WOFF2 in src/assets/fonts/ and print
// the metric overrides for their local fallback faces (src/styles/fonts.css).
// Usage: npm run fonts:subset -- <dir with the google/fonts TTFs> [fallback TTF]
// Sources, commit and SHA-256s: docs/fonts.md. Needs fonttools (pyftsubset) and woff2_compress on PATH.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [dir, fallback = '/usr/share/fonts/liberation/LiberationSans-Regular.ttf'] =
  process.argv.slice(2);
if (!dir) {
  console.error('usage: npm run fonts:subset -- <dir> [fallback.ttf]');
  process.exit(2);
}

// Google Fonts' "latin" range, plus → and × used in report evidence.
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
  'U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD,U+00D7';

const run = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const tmp = mkdtempSync(join(tmpdir(), 'fonts-'));
// Karla ships as a 200–800 variable font; the site uses 400–800.
run('fonttools', [
  'varLib.instancer',
  join(dir, 'ofl_karla_Karla[wght].ttf'),
  'wght=400:800',
  '-o',
  join(tmp, 'karla.ttf'),
]);

const SOURCES: [string, string][] = [
  ['permanent-marker', join(dir, 'apache_permanentmarker_PermanentMarker-Regular.ttf')],
  ['special-elite', join(dir, 'apache_specialelite_SpecialElite-Regular.ttf')],
  ['karla', join(tmp, 'karla.ttf')],
];
for (const [name, ttf] of SOURCES) {
  run('pyftsubset', [
    ttf,
    `--unicodes=${LATIN}`,
    '--layout-features=kern,liga,calt',
    '--no-hinting',
    '--desubroutinize',
    `--output-file=${join(tmp, `${name}.subset.ttf`)}`,
  ]);
  // woff2_compress writes <name>.subset.woff2 beside its input.
  run('woff2_compress', [join(tmp, `${name}.subset.ttf`)]);
  copyFileSync(join(tmp, `${name}.subset.woff2`), `src/assets/fonts/${name}.woff2`);
}

// Fallback overrides, the way Next.js and Fontaine compute them: scale the fallback so
// its average glyph width over a sample of English text matches the web font, then
// set ascent, descent and line gap so the line box is the same height.
const PY = `
import sys
from fontTools.ttLib import TTFont
SAMPLE = "The quick brown fox jumps over the lazy dog. Who is draining your AI? 0123456789"
def avg(path):
    f = TTFont(path); cmap = f.getBestCmap(); hmtx = f['hmtx']; upm = f['head'].unitsPerEm
    w = [hmtx[cmap[ord(c)]][0] for c in SAMPLE if ord(c) in cmap]
    return sum(w) / len(w) / upm, f
fb, _ = avg(sys.argv[1])
for name, path in zip(sys.argv[2::2], sys.argv[3::2]):
    a, f = avg(path); upm = f['head'].unitsPerEm; h = f['hhea']
    size = a / fb
    print(f"{name}: size-adjust: {size*100:.2f}%; ascent-override: {h.ascent/upm/size*100:.2f}%; "
          f"descent-override: {-h.descent/upm/size*100:.2f}%; line-gap-override: {h.lineGap/upm/size*100:.2f}%;")
`;
run('python3', ['-I', '-c', PY, fallback, ...SOURCES.flat()]);
