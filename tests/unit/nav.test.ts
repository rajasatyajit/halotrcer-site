import { describe, expect, it } from 'vitest';
import { BOOKING_URL, SITES, url } from '../../src/config/site.ts';
import { navFor } from '../../src/data/nav.ts';

const labels = (site: (typeof SITES)[number]) => navFor(site).items.map((i) => i.label);
const href = (site: (typeof SITES)[number], label: string) =>
  navFor(site).items.find((i) => i.label === label)?.href;

describe('navFor', () => {
  it('lists the four links per host', () => {
    expect(labels('www')).toEqual(['Tokvera', 'Sievant', 'Pricing', 'Security']);
    expect(labels('tokvera')).toEqual(['Sample report', 'Docs', 'Calculator', 'Pricing']);
    expect(labels('sievant')).toEqual(['Sample report', 'Scan', 'Docs', 'Pricing']);
  });

  it('links Pricing to www and the calculator to tokvera', () => {
    for (const site of SITES) expect(href(site, 'Pricing')).toBe(url('www', '/pricing'));
    expect(href('tokvera', 'Calculator')).toBe(url('tokvera', '/calculator'));
  });

  it('offers Book a call everywhere', () => {
    for (const site of SITES)
      expect(navFor(site).cta).toEqual({ label: 'Book a call', href: BOOKING_URL });
  });
});
