// One-off: subset Permanent Marker to MARKER_UNICODES as WOFF2 in src/assets/fonts/ and print
// the metric overrides for its local fallback face (src/styles/fonts.css).
// Usage: npm run fonts:subset -- <dir with the google/fonts TTF> [fallback TTF]
// Source, commit and SHA-256s: docs/fonts.md. Needs fonttools (pyftsubset) and woff2_compress.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MARKER_UNICODES } from '../src/lib/fonts.ts';

const [dir, fallback = '/usr/share/fonts/liberation/LiberationSans-Regular.ttf'] =
  process.argv.slice(2);
if (!dir) {
  console.error('usage: npm run fonts:subset -- <dir> [fallback.ttf]');
  process.exit(2);
}

const run = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const tmp = mkdtempSync(join(tmpdir(), 'fonts-'));
const ttf = join(dir, 'apache_permanentmarker_PermanentMarker-Regular.ttf');
run('pyftsubset', [
  ttf,
  `--unicodes=${MARKER_UNICODES}`,
  '--layout-features=kern,liga,calt',
  '--no-hinting',
  '--desubroutinize',
  `--output-file=${join(tmp, 'permanent-marker.ttf')}`,
]);
// woff2_compress writes permanent-marker.woff2 beside its input.
run('woff2_compress', [join(tmp, 'permanent-marker.ttf')]);
copyFileSync(join(tmp, 'permanent-marker.woff2'), 'src/assets/fonts/permanent-marker.woff2');

// Fallback overrides, the way Next.js and Fontaine compute them: scale the fallback so its
// average glyph width over a sample of English text matches the web font, then set ascent,
// descent and line gap so the line box is the same height.
const PY = `
import sys
from fontTools.ttLib import TTFont
SAMPLE = "The quick brown fox jumps over the lazy dog. Who is draining your AI? 0123456789"
def avg(path):
    f = TTFont(path); cmap = f.getBestCmap(); hmtx = f['hmtx']; upm = f['head'].unitsPerEm
    w = [hmtx[cmap[ord(c)]][0] for c in SAMPLE if ord(c) in cmap]
    return sum(w) / len(w) / upm, f
fb, _ = avg(sys.argv[1])
a, f = avg(sys.argv[2]); upm = f['head'].unitsPerEm; h = f['hhea']; size = a / fb
print(f"size-adjust: {size*100:.2f}%; ascent-override: {h.ascent/upm/size*100:.2f}%; "
      f"descent-override: {-h.descent/upm/size*100:.2f}%; line-gap-override: {h.lineGap/upm/size*100:.2f}%;")
`;
run('python3', ['-I', '-c', PY, fallback, ttf]);
