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

  it('flags a clue card without its own stamp, inside a sample or not', () => {
    expect(check('<ul><li><article data-clue><h3>Rush hour</h3></article></li></ul>')).toEqual([
      'clue#0',
    ]);
    expect(check(`<div data-sample="x"><article data-clue><h3>R</h3></article></div>`)).toEqual([
      'clue#0',
    ]);
  });

  it('accepts a clue card that carries its stamp', () => {
    expect(check(`<article data-clue><h3>R</h3>${stamp}</article>`)).toEqual([]);
  });

  it('ignores tables outside a sample', () => {
    expect(check('<table><caption>T</caption></table>')).toEqual([]);
  });
});

describe('empty stamps', () => {
  it('rejects an empty or whitespace-only stamp on a clue card', () => {
    expect(check('<article data-clue><h3>R</h3><span data-stamp></span></article>')).toEqual([
      'clue#0',
    ]);
    expect(check('<article data-clue><h3>R</h3><span data-stamp>  \n </span></article>')).toEqual([
      'clue#0',
    ]);
  });

  it('rejects an empty stamp in a sample caption', () => {
    expect(
      check(
        '<div data-sample="x"><table><caption>T <span data-stamp> </span></caption></table></div>',
      ),
    ).toHaveLength(1);
  });
});
