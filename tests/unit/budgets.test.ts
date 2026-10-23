import { describe, expect, it } from 'vitest';
import { isAllowedFont } from '../../scripts/lib/fonts.ts';

describe('isAllowedFont', () => {
  it('accepts the hashed Permanent Marker subset', () => {
    expect(isAllowedFont('_astro/permanent-marker.x-Y_9.woff2')).toBe(true);
    expect(isAllowedFont('dist/www/_astro/permanent-marker.Ab12.woff2')).toBe(true);
  });

  it('rejects every other font file, including the dropped faces', () => {
    expect(isAllowedFont('_astro/karla.Ab12.woff2')).toBe(false);
    expect(isAllowedFont('_astro/special-elite.Q1.woff2')).toBe(false);
    expect(isAllowedFont('fonts/other.woff2')).toBe(false);
    expect(isAllowedFont('_astro/permanent-marker.Ab12.ttf')).toBe(false);
  });
});
