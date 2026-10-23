import { describe, expect, it } from 'vitest';
import { isAllowedFont } from '../../scripts/lib/fonts.ts';

describe('isAllowedFont', () => {
  it('accepts the three hashed Case File fonts', () => {
    expect(isAllowedFont('_astro/karla.Ab12.woff2')).toBe(true);
    expect(isAllowedFont('dist/www/_astro/permanent-marker.x-Y_9.woff2')).toBe(true);
    expect(isAllowedFont('_astro/special-elite.Q1.woff2')).toBe(true);
  });

  it('rejects any other font file', () => {
    expect(isAllowedFont('fonts/other.woff2')).toBe(false);
    expect(isAllowedFont('_astro/karla.Ab12.ttf')).toBe(false);
    expect(isAllowedFont('_astro/inter.Ab12.woff2')).toBe(false);
  });
});
