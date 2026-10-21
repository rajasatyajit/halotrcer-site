// RFC 9116 security.txt. Expires is set a year after each build; rebuild at least yearly.
import type { APIRoute } from 'astro';
import { CONTACT_EMAIL, url } from '../../../../config/site.ts';

export const GET: APIRoute = () => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  expires.setUTCHours(0, 0, 0, 0);
  const body = [
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${url('www', '/.well-known/security.txt')}`,
    `Policy: ${url('www', '/security')}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
