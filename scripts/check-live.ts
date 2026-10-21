// Checks what a server actually sends: security headers, the docs-only CSP,
// status codes, redirects, content types and the install scripts' bytes.
// Use it against `wrangler pages dev` (Cloudflare's own _headers/_redirects
// handling) before a deploy, and against the deployed hosts after one.
//
//   node scripts/check-live.ts                                  # the real hosts
//   node scripts/check-live.ts --www http://127.0.0.1:8781 --tokvera ... --sievant ...
//
// Expected values come from the built dist/<site>/_headers (same commit), plus
// absolute rules that hold whatever the file says.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { HOSTS, SITES, type SiteId } from '../src/config/site.ts';
import { DIST, Report } from './lib/dist.ts';

const { values } = parseArgs({
  options: Object.fromEntries(SITES.map((s) => [s, { type: 'string' as const }])),
});
const base = (site: SiteId) =>
  ((values as Record<string, string | undefined>)[site] ?? `https://${HOSTS[site]}`).replace(
    /\/$/,
    '',
  );

// Header blocks of a _headers file, by path pattern.
function headerRules(site: SiteId): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;
  for (const line of readFileSync(join(DIST, site, '_headers'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) rules.set(line.trim(), (current = new Map()));
    else if (current && !line.trim().startsWith('!')) {
      const i = line.indexOf(':');
      current.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
    }
  }
  return rules;
}

const report = new Report();
let checks = 0;

async function get(site: SiteId, path: string): Promise<Response> {
  return fetch(`${base(site)}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
}

function expect(where: string, ok: boolean, what: string): void {
  checks++;
  if (!ok) report.error(`${where}: ${what}`);
}

function security(where: string, res: Response, site: Map<string, string>, csp: string): void {
  const h = (n: string) => res.headers.get(n) ?? '';
  for (const name of [
    'strict-transport-security',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
    'cross-origin-opener-policy',
    'cross-origin-resource-policy',
    'x-frame-options',
  ]) {
    expect(where, h(name) === site.get(name), `${name} is "${h(name)}", want "${site.get(name)}"`);
  }
  // One CSP header, exactly the expected one (a second header would be joined with ", ").
  expect(where, h('content-security-policy') === csp, `CSP is "${h('content-security-policy')}"`);
  const c = h('content-security-policy');
  expect(
    where,
    !/'unsafe-inline'|'unsafe-eval'/.test(c),
    'CSP allows unsafe-inline or unsafe-eval',
  );
  expect(where, c.includes("frame-ancestors 'none'"), "CSP lacks frame-ancestors 'none'");
  const hsts = h('strict-transport-security');
  const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
  expect(where, maxAge >= 31536000 && /preload/.test(hsts), `HSTS "${hsts}" is not preloadable`);
}

for (const site of SITES) {
  if (!existsSync(join(DIST, site, '_headers'))) continue;
  const rules = headerRules(site);
  const all = rules.get('/*') ?? new Map<string, string>();
  const siteCsp = all.get('content-security-policy') ?? '';
  const docsCsp = rules.get('/docs/*')?.get('content-security-policy');
  const at = (path: string) => `${site} ${base(site)}${path}`;

  // Pages: status, type, headers.
  const pages: [string, number][] = [
    ['/', 200],
    ['/no-such-page-for-check-live', 404],
  ];
  if (site === 'www') pages.push(['/audit', 200], ['/calculator', 200], ['/blog', 200]);
  if (site === 'sievant') pages.push(['/scan', 200], ['/owasp-llm-top-10', 200]);
  if (site === 'tokvera') pages.push(['/calculator', 200], ['/scoring', 200]);
  for (const [path, status] of pages) {
    const res = await get(site, path);
    expect(at(path), res.status === status, `status ${res.status}, want ${status}`);
    expect(at(path), /^text\/html/.test(res.headers.get('content-type') ?? ''), 'not text/html');
    security(at(path), res, all, siteCsp);
  }

  // Docs and search: the one place with 'wasm-unsafe-eval', replacing the site CSP.
  if (docsCsp) {
    const doc = site === 'tokvera' ? '/docs/scan' : '/docs/scan-and-wrap';
    for (const path of ['/docs', doc, '/pagefind/pagefind.js']) {
      const res = await get(site, path);
      expect(at(path), res.status === 200, `status ${res.status}`);
      security(at(path), res, all, docsCsp);
    }
  }

  // Redirects from src/data/redirects.ts.
  for (const line of readFileSync(join(DIST, site, '_redirects'), 'utf8').split('\n')) {
    const [from, to, code] = line.trim().split(/\s+/);
    if (!from || !to) continue;
    const res = await get(site, from);
    expect(at(from), String(res.status) === (code ?? '302'), `status ${res.status}, want ${code}`);
    expect(at(from), res.headers.get('location') === to, `location ${res.headers.get('location')}`);
  }

  // Install scripts: plain text, short cache, byte-identical to the build.
  for (const file of ['install.sh', 'install.ps1']) {
    const local = join(DIST, site, file);
    if (!existsSync(local)) continue;
    const res = await get(site, `/${file}`);
    const body = Buffer.from(await res.arrayBuffer());
    expect(at(`/${file}`), res.status === 200, `status ${res.status}`);
    expect(
      at(`/${file}`),
      res.headers.get('content-type') === 'text/plain; charset=utf-8',
      `content-type ${res.headers.get('content-type')}`,
    );
    expect(
      at(`/${file}`),
      res.headers.get('cache-control') === 'public, max-age=300',
      `cache-control ${res.headers.get('cache-control')}`,
    );
    expect(at(`/${file}`), body.equals(readFileSync(local)), 'body differs from the build');
  }

  // Hashed assets are immutable; feeds and security.txt have the right types.
  const html = await (await get(site, '/')).text();
  const asset = /\/_astro\/[^"]+\.css/.exec(html)?.[0];
  if (asset) {
    const res = await get(site, asset);
    expect(at(asset), /immutable/.test(res.headers.get('cache-control') ?? ''), 'not immutable');
  }
  const types: [string, RegExp][] = [['/robots.txt', /^text\/plain/]];
  if (site === 'www')
    types.push(
      ['/.well-known/security.txt', /^text\/plain/],
      ['/blog/rss.xml', /xml/],
      ['/sitemap-index.xml', /xml/],
    );
  for (const [path, type] of types) {
    const res = await get(site, path);
    expect(at(path), res.status === 200, `status ${res.status}`);
    expect(
      at(path),
      type.test(res.headers.get('content-type') ?? ''),
      `type ${res.headers.get('content-type')}`,
    );
  }
}

console.log(`${checks} live checks.`);
report.finish('live headers, redirects and types');
