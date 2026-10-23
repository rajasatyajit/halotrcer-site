// WCAG 2.2 AA contrast for every text/background token pair, in both themes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf8');

function token(name: string): [string, string] {
  const m = new RegExp(
    `--${name}:\\s*(?:light-dark\\(\\s*(#[0-9a-f]{3,6}),\\s*(#[0-9a-f]{3,6})\\s*\\)|(#[0-9a-f]{3,6}))`,
    'i',
  ).exec(css);
  if (!m) throw new Error(`token --${name} not found or not a hex colour`);
  return m[3] ? [m[3], m[3]] : [m[1] as string, m[2] as string];
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_ON = ['bg', 'surface', 'surface-sunken'];
const PAIRS: [string, string, number][] = [
  ...['ink', 'ink-muted', 'halotrcer', 'tokvera', 'sievant'].flatMap((fg) =>
    TEXT_ON.map((bg) => [fg, bg, 4.5] as [string, string, number]),
  ),
  ...['halotrcer', 'tokvera', 'sievant'].map(
    (bg) => ['accent-ink', bg, 4.5] as [string, string, number],
  ),
  ['bg', 'ink', 4.5],
  ['term-ink', 'term-bg', 4.5],
  ['term-muted', 'term-bg', 4.5],
  ['term-prompt', 'term-bg', 4.5],
  ['focus', 'bg', 3],
  // Severity words (always shown with the word, never colour alone).
  ...['sev-critical', 'sev-high', 'sev-medium', 'sev-low', 'sev-info'].flatMap((fg) =>
    TEXT_ON.map((bg) => [fg, bg, 4.5] as [string, string, number]),
  ),
  ...['sev-critical', 'sev-high', 'sev-medium', 'sev-low', 'sev-info'].map(
    (fg) => [fg, 'paper', 4.5] as [string, string, number],
  ),
  // The Case File board: fixed colours, the same in both themes (DESIGN.md §2).
  ['board-ink', 'card', 4.5],
  ['faded', 'card', 4.5],
  ['yarn', 'card', 4.5],
  ['yarn', 'tag', 4.5],
  ['board-ink', 'tag', 4.5],
  ['on-yarn', 'yarn', 4.5],
  ['board-ink', 'sticky', 4.5],
  ['on-frame', 'frame', 4.5],
  ['on-frame-muted', 'frame', 4.5],
  ['sticky', 'frame', 4.5],
  // Paper sections switch with the theme.
  ['paper-ink', 'paper', 4.5],
  ['label', 'paper', 4.5],
  ['paper', 'paper-ink', 4.5],
  ['label-inverse', 'paper-ink', 4.5],
];

// Two-tone focus ring (ink outline, yellow halo): one of the two reaches 3:1 on every surface.
const FOCUS_ON = ['card', 'cork', 'frame', 'tag', 'paper', 'bg', 'surface', 'surface-sunken'];

describe.each([
  ['light', 0],
  ['dark', 1],
] as const)('%s theme', (_theme, i) => {
  it.each(PAIRS)('--%s on --%s >= %s:1', (fg, bg, min) => {
    expect(ratio(token(fg)[i], token(bg)[i])).toBeGreaterThanOrEqual(min);
  });
  it.each(FOCUS_ON)('focus ring visible on --%s', (bg) => {
    const best = Math.max(
      ratio(token('board-ink')[i], token(bg)[i]),
      ratio(token('sticky')[i], token(bg)[i]),
    );
    expect(best).toBeGreaterThanOrEqual(3);
  });
});
