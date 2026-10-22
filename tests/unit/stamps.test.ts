import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { missingStamps } from '../../scripts/lib/stamps.ts';

const stamp = '<span class="stamp" data-stamp>Simulated demo run</span>';
const check = (html: string) => missingStamps(parse(`<body>${html}</body>`));

describe('missingStamps', () => {
  it('accepts a sample table whose caption carries the stamp', () => {
    expect(
      check(`<div data-sample="x"><table><caption>T ${stamp}</caption></table></div>`),
    ).toEqual([]);
  });

  it('flags a sample table without a stamp', () => {
    expect(check('<div data-sample="x"><table><caption>T</caption></table></div>')).toHaveLength(1);
  });

  it('flags a sample section without a stamp', () => {
    expect(check('<div data-sample="x"><section id="gaps"><h2>Gaps</h2></section></div>')).toEqual([
      'section#gaps in [data-sample=x]',
    ]);
  });

  it('skips data marked as not simulated (e.g. the OWASP mapping)', () => {
    expect(
      check(
        '<div data-sample="x" data-simulated="false"><table><caption>T</caption></table></div>',
      ),
    ).toEqual([]);
  });

  it('ignores tables outside a sample', () => {
    expect(check('<table><caption>T</caption></table>')).toEqual([]);
  });
});
