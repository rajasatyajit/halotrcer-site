// The Marker subset (src/lib/fonts.ts) drives both the font file and which text may use it.
import { describe, expect, it } from 'vitest';
import { inMarkerSubset, MARKER_CHARS, MARKER_UNICODES } from '../../src/lib/fonts.ts';
import { SITES } from '../../src/config/site.ts';
import { board } from '../../src/lib/clues.ts';

describe('Marker subset', () => {
  it('is the characters the site sets in Marker plus the agreed extras', () => {
    for (const c of '0123456789ABCDEF.,:;!?\'"()-–—‘’“”&/…·→×%$ ')
      expect(MARKER_CHARS).toContain(c);
    expect(MARKER_CHARS).toContain('\u00a0');
    // Only what is used: letters the site never sets in Marker are left out.
    expect(MARKER_CHARS).not.toContain('z');
    expect(MARKER_CHARS.length).toBeLessThan(100);
  });

  it('lists the same characters as code points for pyftsubset', () => {
    const fromUnicodes = MARKER_UNICODES.split(',').map((u) =>
      String.fromCodePoint(parseInt(u.replace('U+', ''), 16)),
    );
    expect(fromUnicodes.join('')).toBe(MARKER_CHARS);
  });

  it('covers the copy, curly quotes and dashes, and nothing else', () => {
    expect(inMarkerSubset('MCP server “search” – 5 of 60 → Grade D')).toBe(true);
    expect(inMarkerSubset('Who’s draining your AI?')).toBe(true);
    expect(inMarkerSubset('Café')).toBe(false);
    expect(inMarkerSubset('zebra')).toBe(false);
    expect(inMarkerSubset('服务器')).toBe(false);
  });

  it('covers every clue title and figure on today’s boards', () => {
    for (const site of SITES)
      for (const clue of board(site).clues) {
        expect(inMarkerSubset(clue.title)).toBe(true);
        expect(inMarkerSubset(clue.figure)).toBe(true);
      }
  });
});
