// Single source for hostnames, contact details and the booking link.
// Templates never hand-type a hostname: build links with url().

export const SITES = ['www', 'tokvera', 'sievant'] as const;
export type SiteId = (typeof SITES)[number];

export const HOSTS: Record<SiteId, string> = {
  www: 'www.halotrcer.com',
  tokvera: 'tokvera.halotrcer.com',
  sievant: 'sievant.halotrcer.com',
};

export const SITE_NAMES: Record<SiteId, string> = {
  www: 'Halotrcer',
  tokvera: 'Tokvera',
  sievant: 'Sievant',
};

export const CONTACT_EMAIL = 'satyajit.rajaraman@halotrcer.com';

// Published booking URL. Every page links here; /book redirects to BOOKING_TARGET.
export const BOOKING_PATH = '/book';

// The owner's booking tool (e.g. a Cal.com link). While null, /book renders a
// contact page instead of redirecting, so the published URL never 404s.
export const BOOKING_TARGET: string | null = null;

export function origin(site: SiteId): string {
  return `https://${HOSTS[site]}`;
}

export function url(site: SiteId, path = '/'): string {
  if (!path.startsWith('/') && !path.startsWith('#')) {
    throw new Error(`url(): path must start with "/" or "#", got "${path}"`);
  }
  return `${origin(site)}${path}`;
}

export const BOOKING_URL = url('www', BOOKING_PATH);
