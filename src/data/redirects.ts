// Every redirect, per host. Published URLs never break: a moved page gets a 301 here.
import { BOOKING_PATH, BOOKING_TARGET, url, type SiteId } from '../config/site.ts';

export interface Redirect {
  from: string;
  to: string;
  status: 301 | 302;
}

export function redirectsFor(site: SiteId): Redirect[] {
  const list: Redirect[] = [];
  if (site === 'www' && BOOKING_TARGET) {
    // 302: the booking tool may change; the published /book URL does not.
    list.push({ from: BOOKING_PATH, to: BOOKING_TARGET, status: 302 });
  }
  if (site === 'tokvera' || site === 'sievant') {
    // One install page, on www; the hash opens this product in the picker.
    list.push({ from: '/install', to: url('www', `/install#${site}`), status: 301 });
  }
  return list;
}

export function redirectsFile(site: SiteId): string {
  return redirectsFor(site)
    .map((r) => `${r.from} ${r.to} ${r.status}`)
    .join('\n')
    .concat('\n');
}
