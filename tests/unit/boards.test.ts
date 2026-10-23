// Board copy holds words only: every number comes from a sample (src/lib/clues.ts).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITES } from '../../src/config/site.ts';
import { board } from '../../src/lib/clues.ts';
import { sample } from '../../src/lib/samples.ts';

describe('board copy', () => {
  it('types no digit (case numbers like HAL-001 and p99 are names, not data)', () => {
    const src = readFileSync('src/data/boards.ts', 'utf8')
      .replace(/\b[A-Z]{3}-\d{3}\b/g, '')
      .replace(/\bp\d{2}\b/g, '');
    expect(src.match(/.*\d.*/g) ?? []).toEqual([]);
  });

  it('never carries a version or a URL out of the samples', () => {
    const raw = ['tokvera-scan', 'sievant-posture'].map((id) => sample(id).raw).join('\n');
    const leaks = [
      ...(raw.match(/https?:\/\/[^\s"]+/g) ?? []),
      ...(raw.match(/\bv?\d+\.\d+\.\d+[\w.-]*/g) ?? []),
    ];
    for (const site of SITES) {
      const json = JSON.stringify(board(site));
      expect(leaks.filter((l) => json.includes(l))).toEqual([]);
    }
  });
});
