// Images referenced by synced docs, served at /docs/assets/<file> on the
// product's host (docs link to them rather than inlining them).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getFlags } from '../config/flags.ts';

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
};
const dir = () => join(process.cwd(), 'content', 'docs', getFlags().site, 'assets');

export const getStaticPaths: GetStaticPaths = () =>
  existsSync(dir()) ? readdirSync(dir()).map((file) => ({ params: { file } })) : [];

export const GET: APIRoute = ({ params }) =>
  new Response(readFileSync(join(dir(), String(params.file))), {
    headers: { 'Content-Type': TYPES[extname(String(params.file))] ?? 'application/octet-stream' },
  });
