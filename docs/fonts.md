# Fonts

One web font: a Permanent Marker subset for display (headings, card titles, kind labels,
prices). Body text uses the system UI fonts; card text uses the system monospace fonts
(`Courier New`, `Liberation Mono`, …) for the typed look. Owner decisions 2026-10-23
(`docs/redesign/DESIGN.md` §3). Licence: `NOTICE` and `LICENSES/fonts/Apache-2.0.txt`.

## Why one font

The design first used three faces (Permanent Marker, Special Elite, Karla). On Lighthouse's
simulated mobile connection every font the first screen uses is fetched before the first
paint, and LCP grew with the bytes. Runs on `www/` (pre-launch build, mobile; machine load
below 2):

| Build                                          | Runs | FCP    | LCP                 | CLS | Font bytes |
| ---------------------------------------------- | ---- | ------ | ------------------- | --- | ---------- |
| `main`, before the redesign                    | 1    | 0.91 s | 0.91 s              | 0   | 0          |
| Three faces, Marker preloaded                  | 1    | 1.70 s | 1.81 s              | 0   | 102 KB     |
| Three faces, no preload                        | 1    | 1.66 s | 1.66 s              | 0   | 102 KB     |
| Marker and Karla only                          | 1    | 1.21 s | 1.36 s              | 0   | 49 KB      |
| Three faces, Special Elite trimmed             | 1    | 1.51 s | 1.51 s              | 0   | 89 KB      |
| No web fonts                                   | 1    | 0.91 s | 0.91 s              | 0   | 0          |
| Marker and Karla, both trimmed                 | 1    | 1.21 s | 1.21 s              | 0   | 31 KB      |
| Marker trimmed, preloaded                      | 3    | 0.91 s | 1.36 s (median)     | 0   | 19 KB      |
| **Marker trimmed, not preloaded (this build)** | 3    | 1.21 s | **1.21 s (median)** | 0   | 19 KB      |

Preloading Marker made the hero heading wait for it. Without the preload the font still
lands before the first paint, which costs about 0.3 s against `main`. The owner set the LCP
limit to 1.3 s as the median of 3 runs (`lighthouserc.cjs`). The run-by-run record is in
the M8 ledger (`.superpowers/sdd/2026-10-23-m8-case-file/progress.md`, local, not committed).

## Source

Downloaded once from `github.com/google/fonts` at commit
`e7db6ca603fd4862010383ff17ffd6cc4ffac1c0` (2026-10-23).

| File                                                 | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `apache/permanentmarker/PermanentMarker-Regular.ttf` | `28f82c8a7943cb8e9d599f8554da1d4fc75dbcf69b9885ad6c0611d20c6946c5` |
| `apache/permanentmarker/LICENSE.txt`                 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |

## Subsetting

`npm run fonts:subset -- <dir with the TTF>` (fonttools 4.66.1 and `woff2_compress`, both
local). The range is `MARKER_UNICODES` in `src/lib/fonts.ts`: the 90 characters the built
pages of all three hosts set in Marker (both modes, `node scripts/check-marker.ts --print`)
plus digits, A–F, common punctuation, `→ × % $` and the no-break space.
`npm run check:marker` (in `check:dist` and CI) fails if Marker text on any page uses a
character outside it. A clue title from the samples with a character outside it is set in
the body face (`inMarkerSubset`); other headings fall back glyph by glyph to the metric-matched
fallback face.

| Output                                    | Bytes  | SHA-256                                                            |
| ----------------------------------------- | ------ | ------------------------------------------------------------------ |
| `src/assets/fonts/permanent-marker.woff2` | 16,196 | `18bfcfb5a7f60aab1e01db474a955d1d895321a75b9328de509b9257d5353c70` |

The earlier ASCII-plus-punctuation cut was 18,720 bytes.

## Loading

- Not preloaded (see above).
- `font-display: optional`, not `swap`: with `swap`, a font arriving after the first paint
  rewrapped the hero heading (CLS 0.0011 with fonts delayed 400 ms). With `optional` a late
  font is not used on that page; from the next page on it is cached and shows.
- The fallback face (Arial, Liberation Sans, Arimo or Helvetica) is scaled to Marker:
  `size-adjust: 112.05%; ascent-override: 99.01%; descent-override: 28.33%;
line-gap-override: 2.7%` (the subset script prints these).
- The CSS family name is our own (`Case Marker`): with the font's real name, a visitor who
  has it installed got the system copy swapped in after the first paint, which moved the
  layout.
- `npm run budget` charges the file to every page and fails on any other font file.
