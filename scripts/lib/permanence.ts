// Published URLs never break (PLAN.md §3). data/published-urls.json records
// every canonical URL a build has put in a sitemap, with the mode that first
// served it. A recorded URL must still be in the sitemap or be redirected (a
// 301 in src/data/redirects.ts); a new sitemap URL must be recorded.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTS, type SiteId } from '../../src/config/site.ts';

export type Mode = 'prelaunch' | 'launched';
// URL -> the mode that first served it. Pre-launch URLs must exist in both modes.
export type Recorded = Record<string, Mode>;

export const RECORD_FILE = join('data', 'published-urls.json');

export function loadRecorded(file = RECORD_FILE): Recorded {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Recorded) : {};
}

export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] ?? '').replace(/&amp;/g, '&'));
}

export function redirectSources(text: string): Set<string> {
  return new Set(
    text
      .split('\n')
      .map((l) => l.trim().split(/\s+/)[0] ?? '')
      .filter((p) => p.startsWith('/')),
  );
}

// Adds new URLs; never removes one or downgrades launched to prelaunch.
export function record(recorded: Recorded, urls: string[], mode: Mode): Recorded {
  const next: Recorded = { ...recorded };
  for (const u of urls) {
    if (!next[u] || (next[u] === 'launched' && mode === 'prelaunch')) next[u] = mode;
  }
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
}

export interface SiteBuild {
  site: SiteId;
  sitemap: string[];
  redirects: Set<string>;
}

export function problems(recorded: Recorded, builds: SiteBuild[], mode: Mode): string[] {
  const out: string[] = [];
  for (const b of builds) {
    const origin = `https://${HOSTS[b.site]}`;
    const live = new Set(b.sitemap);
    for (const [u, since] of Object.entries(recorded)) {
      if (!u.startsWith(`${origin}/`)) continue;
      if (mode === 'prelaunch' && since === 'launched') continue;
      const path = new URL(u).pathname;
      if (!live.has(u) && !b.redirects.has(path))
        out.push(`${u} was published and is gone: add a 301 in src/data/redirects.ts`);
    }
    for (const u of b.sitemap) {
      if (!recorded[u]) out.push(`${u} is new: run npm run urls:record and commit the file`);
    }
  }
  return out;
}

// Published files that are not pages but are linked as URLs (the sample downloads). They are
// recorded and checked like sitemap URLs. `files` are paths relative to dist/<site>.
export function downloadUrls(site: SiteId, files: string[]): string[] {
  return files
    .filter((f) => /^samples\/[^/]+\.json$/.test(f.replaceAll('\\', '/')))
    .map((f) => `https://${HOSTS[site]}/${f.replaceAll('\\', '/')}`)
    .sort();
}
