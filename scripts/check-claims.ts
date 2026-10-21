// Honesty gate. Scans the visible text (plus titles and meta descriptions) of every
// built page. Sourced content is excluded: <Claim> output (data-claim), docs synced
// from a product repo at a recorded commit (data-source-doc), sample reports
// rendered from a synced file at a recorded commit (data-sample), the reader's own
// calculator inputs (data-user-input), owner-sourced pricing (data-owner-source),
// customer proof with a recorded source and permission (data-proof) and dates
// (<time>). Proof may appear only while content/proof has entries. Code and terminal panels are scanned too. What remains must
// contain no metric, count or customer-proof phrasing.
import { existsSync, readdirSync } from 'node:fs';
import { loadClaims } from '../src/lib/claims.ts';
import { builtSites, pages, Report } from './lib/dist.ts';
import { findViolations } from './lib/rules.ts';

const EXCLUDE =
  'script, style, time, [data-claim], [data-source-doc], [data-sample], [data-user-input], [data-owner-source], [data-proof]';

const report = new Report();
const proofFiles = new Set(
  existsSync('content/proof')
    ? readdirSync('content/proof')
        .filter((f) => f.endsWith('.md'))
        .map((f) => `content/proof/${f}`)
    : [],
);
loadClaims(); // fails on a malformed or incomplete registry

for (const site of builtSites()) {
  for (const page of pages(site)) {
    const where = `${site}/${page.rel}`;
    const meta = [
      page.root.querySelector('title')?.textContent ?? '',
      page.root.querySelector('meta[name=description]')?.getAttribute('content') ?? '',
    ];
    const body = page.root.querySelector('body');
    if (!body) continue;
    for (const el of body.querySelectorAll('[data-proof]')) {
      const file = el.getAttribute('data-proof') ?? '';
      if (!proofFiles.has(file))
        report.error(`${where}: proof from ${file || '?'}, which does not exist`);
    }
    if (proofFiles.size === 0 && body.querySelector('#proof'))
      report.error(`${where}: a proof section with no content/proof entries`);
    for (const el of body.querySelectorAll(EXCLUDE)) el.remove();
    const visible = body.structuredText.replace(/\s+/g, ' ');
    for (const text of [...meta, visible]) {
      for (const v of findViolations(text)) report.error(`${where}: unsourced ${v}`);
    }
  }
}

report.finish('claims (no unsourced numbers or customer proof)');
