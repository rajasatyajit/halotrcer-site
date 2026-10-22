import { describe, expect, it } from 'vitest';
import { ogSvg } from '../../src/lib/og.ts';

const base = { site: 'tokvera', siteName: 'Tokvera', title: 'T', description: 'D' } as const;

describe('ogSvg', () => {
  it('draws a bordered stamp into the image', () => {
    const svg = ogSvg({ ...base, stamp: 'Simulated demo run' });
    expect(svg).toContain('SIMULATED DEMO RUN');
    expect(svg).toMatch(/<rect[^>]*stroke="#/);
  });

  it('has no stamp unless asked', () => {
    expect(ogSvg(base)).not.toMatch(/stroke=/);
  });

  it('lists prices for the pricing template', () => {
    const svg = ogSvg({
      ...base,
      prices: [{ name: 'Agent Security Review', label: 'From $7,500' }],
    });
    expect(svg).toContain('Agent Security Review');
    expect(svg).toContain('From $7,500');
  });
});
