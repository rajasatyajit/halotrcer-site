// Asserts each built site's _headers carries the security policy, and that no
// page needs 'unsafe-inline': no inline executable scripts, no style attributes or
// <style> elements, no third-party scripts or stylesheets.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { builtSites, DIST, pages, Report } from './lib/dist.ts';
import { parseHeaders } from './lib/rules.ts';

const report = new Report();
const analytics = process.env.ANALYTICS === 'true';

for (const site of builtSites()) {
  const rules = parseHeaders(readFileSync(join(DIST, site, '_headers'), 'utf8'));
  const all = rules.get('/*');
  if (!all) {
    report.error(`${site}: _headers has no /* rule`);
    continue;
  }
  const need = (name: string, test: (v: string) => boolean, why: string) => {
    const v = all.get(name);
    if (v === undefined || !test(v))
      report.error(`${site}: ${name} ${why} (got: ${v ?? 'missing'})`);
  };
  const csp = all.get('content-security-policy') ?? '';
  const directives = new Map(
    csp.split(';').map((d) => {
      const [k = '', ...v] = d.trim().split(/\s+/);
      return [k, v.join(' ')] as const;
    }),
  );
  need(
    'content-security-policy',
    (v) => !/unsafe-(inline|eval)|unsafe-hashes|\*/.test(v),
    "must not allow unsafe-* or '*'",
  );
  for (const [d, expected] of Object.entries({
    'default-src': "'none'",
    'style-src': "'self'",
    'base-uri': "'none'",
    'frame-ancestors': "'none'",
    'form-action': "'self'",
  })) {
    if (directives.get(d) !== expected)
      report.error(
        `${site}: CSP ${d} must be ${expected} (got: ${directives.get(d) ?? 'missing'})`,
      );
  }
  const scriptSrc = analytics ? "'self' https://static.cloudflareinsights.com" : "'self'";
  if (directives.get('script-src') !== scriptSrc)
    report.error(`${site}: CSP script-src must be ${scriptSrc}`);
  need(
    'strict-transport-security',
    (v) => {
      const age = Number(/max-age=(\d+)/.exec(v)?.[1] ?? 0);
      return age >= 31536000 && /includeSubDomains/.test(v) && /preload/.test(v);
    },
    'needs max-age >= 1 year, includeSubDomains, preload',
  );
  need('x-content-type-options', (v) => v === 'nosniff', 'must be nosniff');
  need(
    'referrer-policy',
    (v) => v === 'strict-origin-when-cross-origin',
    'must be strict-origin-when-cross-origin',
  );
  need(
    'permissions-policy',
    (v) =>
      ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()'].every((f) =>
        v.includes(f),
      ),
    'must deny unused features',
  );
  need('cross-origin-opener-policy', (v) => v === 'same-origin', 'must be same-origin');
  need('cross-origin-resource-policy', (v) => v === 'same-origin', 'must be same-origin');
  need('x-frame-options', (v) => v === 'DENY', 'must be DENY');

  // Docs pages may replace the CSP only to add 'wasm-unsafe-eval' (Pagefind search).
  for (const docs of [rules.get('/docs'), rules.get('/docs/*'), rules.get('/pagefind/*')]) {
    if (!docs) continue;
    const docsCsp = docs.get('content-security-policy') ?? '';
    if (!docs.has('!content-security-policy'))
      report.error(`${site}: a docs rule sets a CSP without detaching the site one`);
    if (docsCsp !== csp.replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'")) {
      report.error(
        `${site}: /docs/* CSP must equal the site CSP plus 'wasm-unsafe-eval' (got: ${docsCsp})`,
      );
    }
  }

  for (const page of pages(site)) {
    const where = `${site}/${page.rel}`;
    for (const s of page.root.querySelectorAll('script')) {
      const src = s.getAttribute('src');
      const type = s.getAttribute('type');
      if (src) {
        if (/^(https?:)?\/\//.test(src)) report.error(`${where}: third-party script ${src}`);
      } else if (type !== 'application/ld+json') {
        report.error(
          `${where}: inline <script${type ? ` type="${type}"` : ''}> would need 'unsafe-inline'`,
        );
      }
    }
    if (page.root.querySelector('style'))
      report.error(`${where}: <style> element would need 'unsafe-inline'`);
    for (const el of page.root.querySelectorAll('[style]'))
      report.error(`${where}: style attribute on <${el.tagName.toLowerCase()}>`);
    for (const l of page.root.querySelectorAll(
      'link[rel=stylesheet], link[rel=preload], link[rel=modulepreload]',
    )) {
      const href = l.getAttribute('href') ?? '';
      if (/^(https?:)?\/\//.test(href)) report.error(`${where}: third-party resource ${href}`);
    }
  }
}

report.finish('headers and CSP');
