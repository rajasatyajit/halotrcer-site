// Which text is set in Permanent Marker, read from the built CSS and pages, so the font
// subset and its build check follow the site rather than a hand-kept list.
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import { markerChars, markerRules, missingGlyphs } from '../../scripts/lib/marker.ts';

const css =
  'h1,h2,h3{font-family:var(--font-marker);font-weight:400}' +
  '.site-footer h2{font-family:var(--font-body)}' +
  '.clue__title--plain{font-family:var(--font-body);font-weight:800}' +
  '@media (width>=48rem){.kicker{font-family:var(--font-marker);text-transform:uppercase}}' +
  '.stamp{font-family:var(--font-type);text-transform:uppercase}';

describe('markerRules', () => {
  it('splits selectors into Marker, other faces and uppercase', () => {
    expect(markerRules(css)).toEqual({
      marker: ['h1', 'h2', 'h3', '.kicker'],
      plain: ['.site-footer h2', '.clue__title--plain', '.stamp'],
      upper: ['.kicker', '.stamp'],
    });
  });
});

describe('markerChars', () => {
  const rules = markerRules(css);
  const chars = (html: string) =>
    [...markerChars(parse(`<body>${html}</body>`), rules)].sort().join('');

  it('collects text in Marker elements, including their children', () => {
    expect(chars("<h1>Who's <span>AI?</span></h1>")).toBe(" '?AIWhos".split('').sort().join(''));
  });

  it('skips elements that another rule sets in a different face', () => {
    expect(
      chars(
        '<footer class="site-footer"><h2>Zq</h2></footer><h3 class="clue__title--plain">é</h3>',
      ),
    ).toBe('');
  });

  it('adds the uppercase forms where a Marker rule uppercases', () => {
    expect(chars('<p class="kicker">ab</p>')).toBe('ABab');
  });
});

describe('missingGlyphs', () => {
  it('lists characters outside the subset, ignoring whitespace', () => {
    expect(missingGlyphs(new Set(['a', 'é', ' ', '\n']), 'abc')).toEqual(['é']);
  });
});
