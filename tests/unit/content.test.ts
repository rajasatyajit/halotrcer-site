import { describe, expect, it } from 'vitest';
import { SITES } from '../../src/config/site.ts';
import { claim } from '../../src/lib/claims.ts';
import { hero, heroVariants } from '../../src/lib/heroes.ts';
import { formatPrice, loadPricing, parsePricing } from '../../src/lib/pricing.ts';

describe('hero variants', () => {
  it.each(SITES)('%s has three variants whose claims all exist', (site) => {
    const variants = heroVariants(site);
    expect(variants.map((v) => v.id)).toEqual(['a', 'b', 'c']);
    for (const v of variants) {
      expect(() => claim(v.title)).not.toThrow();
      expect(() => claim(v.lede)).not.toThrow();
    }
  });
  it.each(SITES)('%s builds variant a by default', (site) => {
    expect(hero(site, 'a').id).toBe('a');
  });
  it('refuses to build a draft variant', () => {
    expect(() => hero('www', 'b')).toThrow(/draft/);
  });
});

describe('pricing', () => {
  it('loads the owner-set prices', () => {
    const p = loadPricing();
    expect(p.source).toBe('owner');
    expect(p.services.map((s) => [s.name, s.from])).toEqual([
      ['AI Performance & Observability Audit', 3500],
      ['Agent Security Review', 7500],
      ['AI Cost & Security Audit', 9500],
    ]);
  });
  it('formats USD', () => {
    expect(formatPrice(9500)).toBe('$9,500');
  });
  it('rejects pricing without an owner source', () => {
    expect(() => parsePricing('---\ncurrency: USD\nservices: []\n---\n')).toThrow();
  });
});
