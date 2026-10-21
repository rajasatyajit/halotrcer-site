// Shared static endpoints, re-exported from each site's pages directory.
import type { APIRoute } from 'astro';
import { getFlags } from '../config/flags.ts';
import { url } from '../config/site.ts';
import { faviconSvg } from './favicon.ts';

export const favicon: APIRoute = () =>
  new Response(faviconSvg(getFlags().site), { headers: { 'Content-Type': 'image/svg+xml' } });

export const robots: APIRoute = () => {
  const { site } = getFlags();
  const lines = ['User-agent: *', 'Allow: /', '', `Sitemap: ${url(site, '/sitemap.xml')}`];
  if (site === 'www') lines.push(`Sitemap: ${url('www', '/sitemap-index.xml')}`);
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
