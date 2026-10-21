// Shared static endpoints, re-exported from each site's pages directory.
import type { APIRoute } from 'astro';
import { getFlags } from '../config/flags.ts';
import { faviconSvg } from './favicon.ts';

export const favicon: APIRoute = () =>
  new Response(faviconSvg(getFlags().site), { headers: { 'Content-Type': 'image/svg+xml' } });

export const robots: APIRoute = () => new Response('User-agent: *\nAllow: /\n');
