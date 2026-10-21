// Honesty gate. Scans the visible text (plus titles and meta descriptions) of every
// built page. Sourced content is excluded: <Claim> output (data-claim), docs synced
// from a product repo at a recorded commit (data-source-doc), sample reports
// rendered from a synced file at a recorded commit (data-sample), the reader's own
// calculator inputs (data-user-input), owner-sourced pricing (data-owner-source)
// and dates (<time>). Code and terminal panels are scanned too. What remains must
// contain no metric, count or customer-proof phrasing.
import { loadClaims } from '../src/lib/claims.ts';
import { builtSites, pages, Report } from './lib/dist.ts';
import { findViolations } from './lib/rules.ts';

const EXCLUDE =
  'script, style, time, [data-claim], [data-source-doc], [data-sample], [data-user-input], [data-owner-source]';

const report = new Report();
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
    for (const el of body.querySelectorAll(EXCLUDE)) el.remove();
    const visible = body.structuredText.replace(/\s+/g, ' ');
    for (const text of [...meta, visible]) {
      for (const v of findViolations(text)) report.error(`${where}: unsourced ${v}`);
    }
  }
}

report.finish('claims (no unsourced numbers or customer proof)');
