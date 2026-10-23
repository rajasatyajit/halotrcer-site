# Fonts

Owner decision 2026-10-23 (`docs/redesign/DESIGN.md` §3): three self-hosted fonts, Latin
subset, WOFF2. Only Permanent Marker is preloaded. Licences: `NOTICE` and `LICENSES/fonts/`.

## Sources

Downloaded once from `github.com/google/fonts` at commit
`e7db6ca603fd4862010383ff17ffd6cc4ffac1c0` (2026-10-23).

| File                                                                | SHA-256                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apache/permanentmarker/PermanentMarker-Regular.ttf`                | `28f82c8a7943cb8e9d599f8554da1d4fc75dbcf69b9885ad6c0611d20c6946c5` |
| `apache/specialelite/SpecialElite-Regular.ttf`                      | `a776fcb4ceb8bdf03e2967688ebdad42680de5b91a7e62c17e718ae212d14bc4` |
| `ofl/karla/Karla[wght].ttf`                                         | `ed3ca4cd9bdd899c543927c30bf5ff50706b24b3f2b7328e64b25f7d2a9d23dc` |
| `apache/permanentmarker/LICENSE.txt` (= `specialelite/LICENSE.txt`) | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| `ofl/karla/OFL.txt`                                                 | `edf2c840acb9570fe02f40721126aa0da4e4011a0030cc6dce30780569f609b6` |

## Subsetting

`npm run fonts:subset -- <dir with the TTFs>` (fonttools 4.66.1 and `woff2_compress`, both
local). Karla is first limited to `wght=400:800`. The range is Google Fonts' "latin" plus
U+00D7 (×). Glyphs outside it (the severity shapes ◆▲■●○) fall back to system fonts.

| Output                                    | Bytes  | SHA-256                                                            |
| ----------------------------------------- | ------ | ------------------------------------------------------------------ |
| `src/assets/fonts/permanent-marker.woff2` | 28,872 | `f4af5d51be475f9b377a5d37978bd91c669a0313f32d7cf8fb31431eac8d6ab5` |
| `src/assets/fonts/special-elite.woff2`    | 53,120 | `e46ba238552fc393bf0415472c7ac86e6c98b7216aea57a920650b3855873116` |
| `src/assets/fonts/karla.woff2`            | 19,280 | `da99a0f9d0ae70a6194b57b2546a49101e9baace38e48244c0716826f7253211` |

## Fallbacks and loading

Each face has a local fallback face (Arial, Liberation Sans, Arimo or Helvetica) scaled to
its average glyph width and line metrics. The script prints the values; `src/styles/fonts.css`
holds them:

| Face             | size-adjust | ascent | descent | line gap |
| ---------------- | ----------- | ------ | ------- | -------- |
| Permanent Marker | 112.05%     | 99.01% | 28.33%  | 2.70%    |
| Special Elite    | 113.47%     | 61.97% | 26.16%  | 0%       |
| Karla            | 100.60%     | 91.16% | 25.05%  | 0%       |

`font-display` is `optional`, not the `swap` that DESIGN.md names. Average-width matching
still rewraps a heading when a font arrives after the first paint: with every font delayed by
400 ms, `swap` measured a cumulative layout shift of 0.0011 on `www/`, against the CLS 0 gate.
With `optional`, a late font is not swapped in, so the page never moves. The preloaded Marker
normally arrives in time, and cached fonts always do (`tests/e2e/fonts.spec.ts`).

`npm run budget` charges all three files (101,272 bytes) to every page, and fails on any
other font file.
