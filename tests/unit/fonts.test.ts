// The Marker subset (src/lib/fonts.ts) drives both the font file and which text may use it.
import { describe, expect, it } from 'vitest';
import { inMarkerSubset, MARKER_UNICODES } from '../../src/lib/fonts.ts';
import { SITES } from '../../src/config/site.ts';
import { board } from '../../src/lib/clues.ts';

describe('Marker subset', () => {
  it('is printable ASCII plus the punctuation the copy uses', () => {
    expect(MARKER_UNICODES).toBe(
      'U+0020-007E,U+00B7,U+00D7,U+2013-2014,U+2018-2019,U+201C-201D,U+2026,U+2192',
    );
  });

  it('covers ASCII, curly quotes and dashes, and nothing else', () => {
    expect(inMarkerSubset('MCP server “search” – 5 of 60 → Grade D')).toBe(true);
    expect(inMarkerSubset('Who’s draining your AI?')).toBe(true);
    expect(inMarkerSubset('Café')).toBe(false);
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
