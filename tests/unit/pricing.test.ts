import { describe, expect, it } from 'vitest';
import { loadPricing, parsePricing, priceLabel } from '../../src/lib/pricing.ts';

const md = (svc: string) =>
  `---\nsource: owner\ndecided: 2026-10-23\ncurrency: USD\nservices:\n${svc}\n---\n`;
const svc = (price: string) =>
  `  - {id: x, name: X, kicker: K, product: www, ${price}duration: D, summary: S, deliverables: [a]}`;

describe('pricing', () => {
  it('labels starting prices "From $X" and fixed prices "$X"', () => {
    const one = (price: string) => {
      const s = parsePricing(md(svc(price))).services[0];
      if (!s) throw new Error('no service');
      return s;
    };
    expect(priceLabel(one('from: 3500, '))).toBe('From $3,500');
    expect(priceLabel(one('price: 9500, '))).toBe('$9,500');
    expect(priceLabel(one('from: 3500, '), { inSentence: true })).toBe('from $3,500');
  });

  it('rejects a service with both or neither price', () => {
    expect(() => parsePricing(md(svc('from: 1, price: 2, ')))).toThrow();
    expect(() => parsePricing(md(svc('')))).toThrow();
  });

  it('reads the owner prices, kickers and durations', () => {
    const services = loadPricing().services;
    expect(services.map((s) => priceLabel(s))).toEqual([
      'From $3,500',
      'From $7,500',
      'From $9,500',
    ]);
    expect(services.map((s) => s.kicker)).toEqual([
      'Your bill or latency',
      "Your customer's security review",
      'Both detectives',
    ]);
    expect(services.find((s) => s.id === 'cost-security-audit')?.duration).toBe('2–3 weeks');
  });
});
