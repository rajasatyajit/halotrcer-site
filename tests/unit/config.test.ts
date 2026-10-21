import { describe, expect, it } from 'vitest';
import { parseFlags } from '../../src/config/flags.ts';
import { BOOKING_URL, url } from '../../src/config/site.ts';
import { canonicalPath } from '../../src/lib/paths.ts';
import { routePattern } from '../../integrations/sites.ts';
import { redirectsFor } from '../../src/data/redirects.ts';

describe('flags', () => {
  it('defaults every flag to false', () => {
    expect(parseFlags({ SITE_ID: 'www' })).toEqual({
      site: 'www',
      launched: false,
      installEndpoints: false,
      analytics: false,
    });
  });
  it('reads true values', () => {
    const f = parseFlags({ SITE_ID: 'sievant', LAUNCHED: 'true', INSTALL_ENDPOINTS: '1' });
    expect(f.launched).toBe(true);
    expect(f.installEndpoints).toBe(true);
  });
  it('rejects unknown sites and malformed booleans', () => {
    expect(() => parseFlags({ SITE_ID: 'blog' })).toThrow(/SITE_ID/);
    expect(() => parseFlags({ SITE_ID: 'www', LAUNCHED: 'yes' })).toThrow(/LAUNCHED/);
  });
});

describe('url()', () => {
  it('builds absolute cross-host URLs', () => {
    expect(url('tokvera', '/scoring')).toBe('https://tokvera.halotrcer.com/scoring');
    expect(url('www')).toBe('https://www.halotrcer.com/');
    expect(BOOKING_URL).toBe('https://www.halotrcer.com/book');
  });
  it('rejects relative paths', () => {
    expect(() => url('www', 'audit')).toThrow();
  });
});

describe('canonicalPath()', () => {
  it.each([
    ['/', '/'],
    ['/index', '/'],
    ['/index.html', '/'],
    ['/audit', '/audit'],
    ['/audit/', '/audit'],
    ['/audit.html', '/audit'],
    ['/docs/index', '/docs'],
    ['/docs/scan.html', '/docs/scan'],
  ])('%s -> %s', (input, expected) => expect(canonicalPath(input)).toBe(expected));
});

describe('routePattern()', () => {
  it.each([
    ['index.astro', '/'],
    ['404.astro', '/404'],
    ['book.astro', '/book'],
    ['docs/index.astro', '/docs'],
    ['docs/[slug].astro', '/docs/[slug]'],
    ['robots.txt.ts', '/robots.txt'],
  ])('%s -> %s', (input, expected) => expect(routePattern(input)).toBe(expected));
});

describe('redirects', () => {
  it('has no /book redirect while the booking target is unset', () => {
    expect(redirectsFor('www').find((r) => r.from === '/book')).toBeUndefined();
  });
});
