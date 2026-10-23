// Header navigation per host. Cross-host entries use url(); same-host entries are paths.
import { BOOKING_URL, url, type SiteId } from '../config/site.ts';

export interface NavItem {
  label: string;
  href: string;
}

export interface Nav {
  items: NavItem[];
  // The header's button: the same booking link on every host.
  cta: NavItem;
}

const PRICING: NavItem = { label: 'Pricing', href: url('www', '/pricing') };

function items(site: SiteId): NavItem[] {
  switch (site) {
    case 'www':
      return [
        { label: 'Tokvera', href: url('tokvera') },
        { label: 'Sievant', href: url('sievant') },
        PRICING,
        { label: 'Security', href: url('www', '/security') },
      ];
    case 'tokvera':
      return [
        { label: 'Sample report', href: url('tokvera', '/sample-report') },
        { label: 'Docs', href: url('tokvera', '/docs') },
        { label: 'Calculator', href: url('tokvera', '/calculator') },
        PRICING,
      ];
    case 'sievant':
      return [
        { label: 'Sample report', href: url('sievant', '/sample-report') },
        { label: 'Scan', href: url('sievant', '/scan') },
        { label: 'Docs', href: url('sievant', '/docs') },
        PRICING,
      ];
  }
}

export function navFor(site: SiteId): Nav {
  return { items: items(site), cta: { label: 'Book a call', href: BOOKING_URL } };
}
