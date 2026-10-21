// Header navigation per host. Cross-host entries use url(); same-host entries are paths.
import { url, type SiteId } from '../config/site.ts';

export interface NavItem {
  label: string;
  href: string;
}

export function navFor(site: SiteId): NavItem[] {
  switch (site) {
    case 'www':
      return [
        { label: 'Audit', href: url('www', '/audit') },
        { label: 'Pricing', href: url('www', '/pricing') },
        { label: 'Tokvera', href: url('tokvera') },
        { label: 'Sievant', href: url('sievant') },
      ];
    case 'tokvera':
      return [
        { label: 'Sievant', href: url('sievant') },
        { label: 'Halotrcer', href: url('www') },
      ];
    case 'sievant':
      return [
        { label: 'Tokvera', href: url('tokvera') },
        { label: 'Halotrcer', href: url('www') },
      ];
  }
}
