import { describe, expect, it } from 'vitest';
import { compute, encode, EXAMPLE, parse, summary } from '../../src/lib/calculator.ts';

describe('calculator', () => {
  it('computes spend and repeated, uncached input spend from the inputs', () => {
    const r = compute({ r: 1_000_000, tin: 1000, tout: 100, pin: 2, pout: 10, h: 25 });
    // 1M × (1000 × 2 + 100 × 10) / 1M = 3000; 1M × 1000 × 0.25 × 2 / 1M = 500
    expect(r.spend).toBe(3000);
    expect(r.repeat).toBe(500);
    expect(r.share).toBeCloseTo(16.667, 2);
  });

  it('reports a zero share when spend is zero', () => {
    expect(compute({ ...EXAMPLE, r: 0 }).share).toBe(0);
  });

  it('round-trips through the query string', () => {
    expect(parse(new URLSearchParams(encode(EXAMPLE)))).toEqual(EXAMPLE);
  });

  it.each([
    ['a missing field', 'r=1&tin=1&tout=1&pin=1&pout=1'],
    ['an empty field', 'r=&tin=1&tout=1&pin=1&pout=1&h=1'],
    ['a negative number', 'r=-1&tin=1&tout=1&pin=1&pout=1&h=1'],
    ['a non-number', 'r=abc&tin=1&tout=1&pin=1&pout=1&h=1'],
    ['infinity', 'r=Infinity&tin=1&tout=1&pin=1&pout=1&h=1'],
    ['a share over 100', 'r=1&tin=1&tout=1&pin=1&pout=1&h=101'],
  ])('rejects %s', (_, qs) => {
    expect(parse(new URLSearchParams(qs))).toBeUndefined();
  });

  it('never calls the result savings', () => {
    const text = summary(EXAMPLE, compute(EXAMPLE), 'https://www.halotrcer.com/calculator');
    expect(text).not.toMatch(/sav(e|ing)/i);
    expect(text).toMatch(/estimate/i);
  });
});
