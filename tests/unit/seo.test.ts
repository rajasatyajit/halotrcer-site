import { describe, expect, it } from 'vitest';
import { faqEntries, serialize, breadcrumbs, service } from '../../src/lib/jsonld.ts';
import { ogImagePath, wrap } from '../../src/lib/og.ts';
import { loadPricing } from '../../src/lib/pricing.ts';

describe('OG images', () => {
  it('maps canonical paths to image paths', () => {
    expect(ogImagePath('/')).toBe('/og/index.png');
    expect(ogImagePath('/docs/scan')).toBe('/og/docs/scan.png');
  });
  it('wraps titles and marks truncation', () => {
    expect(wrap('Find where your AI spend leaks', 26, 3)).toEqual([
      'Find where your AI spend',
      'leaks',
    ]);
    const long = wrap('one two three four five six seven eight nine ten eleven twelve', 10, 2);
    expect(long).toHaveLength(2);
    expect(long[1]?.endsWith('…')).toBe(true);
  });
});

describe('JSON-LD', () => {
  it('escapes "<" so a data block can never close its script', () => {
    expect(serialize([{ name: '</script><b>' }])).not.toContain('</script>');
  });
  it('numbers breadcrumbs from the home page', () => {
    const b = breadcrumbs('tokvera', [{ name: 'Docs', path: '/docs' }]) as {
      itemListElement: { position: number; item: string }[];
    };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1]?.item).toBe('https://tokvera.halotrcer.com/docs');
  });
  it('prices services from content/pricing.md', () => {
    const first = loadPricing().services[0];
    if (!first) throw new Error('content/pricing.md has no services');
    const s = service(first) as {
      offers: { priceSpecification: { minPrice: number } };
    };
    expect(s.offers.priceSpecification.minPrice).toBe(3500);
  });
  it('reads every FAQ question from the synced doc', () => {
    const tokvera = faqEntries('tokvera/faq');
    expect(tokvera.length).toBeGreaterThanOrEqual(10);
    expect(tokvera[0]?.question).toMatch(/\?$/);
    expect(tokvera.every((e) => e.answer.length > 10)).toBe(true);
  });
});
