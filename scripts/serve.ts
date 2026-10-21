// Serves the built sites the way Cloudflare Pages does, for e2e tests: clean URLs,
// 404.html with status 404, _redirects, and the _headers rules (so the real CSP
// applies in the browser). Usage: node scripts/serve.ts  (www :4321, tokvera :4322, sievant :4323)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { parseHeaders } from './lib/rules.ts';
import { SITES, type SiteId } from '../src/config/site.ts';

export const PORTS: Record<SiteId, number> = { www: 4321, tokvera: 4322, sievant: 4323 };

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.sh': 'text/plain; charset=utf-8',
  '.ps1': 'text/plain; charset=utf-8',
};

function matches(pattern: string, path: string): boolean {
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return re.test(path);
}

function serve(site: SiteId): void {
  const root = join(process.cwd(), 'dist', site);
  const rules = parseHeaders(readFileSync(join(root, '_headers'), 'utf8'));
  const redirects = readFileSync(join(root, '_redirects'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(/\s+/));

  createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    for (const [pattern, headers] of rules) {
      if (!matches(pattern, path)) continue;
      for (const [k, v] of headers) {
        if (k.startsWith('!')) res.removeHeader(k.slice(1));
        else res.setHeader(k, v);
      }
    }
    const redirect = redirects.find(([from]) => from === path);
    if (redirect) {
      res.writeHead(Number(redirect[2] ?? 301), { Location: redirect[1] });
      res.end();
      return;
    }
    const rel = normalize(path)
      .replace(/^(\.\.[/\\])+/, '')
      .replace(/^\//, '');
    const candidates = rel === '' ? ['index.html'] : [rel, `${rel}.html`, join(rel, 'index.html')];
    const file = candidates
      .map((c) => join(root, c))
      .find((f) => existsSync(f) && statSync(f).isFile());
    const status = file ? 200 : 404;
    const body = readFileSync(file ?? join(root, '404.html'));
    res.writeHead(status, {
      'Content-Type': (file ? TYPES[extname(file)] : TYPES['.html']) ?? 'application/octet-stream',
    });
    res.end(body);
  }).listen(PORTS[site], '127.0.0.1');
  console.log(`${site}: http://127.0.0.1:${PORTS[site]}`);
}

for (const site of SITES) if (existsSync(join(process.cwd(), 'dist', site))) serve(site);
