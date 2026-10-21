// Helpers for checks that run against the built sites in dist/<site>.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';
import { SITES, type SiteId } from '../../src/config/site.ts';

export const DIST = join(process.cwd(), 'dist');

export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

export function builtSites(): SiteId[] {
  const sites = SITES.filter((s) => existsSync(join(DIST, s)));
  if (sites.length === 0) throw new Error('No built sites in dist/. Run `npm run build` first.');
  return sites;
}

export interface Page {
  site: SiteId;
  file: string;
  rel: string;
  root: HTMLElement;
}

export function pages(site: SiteId): Page[] {
  const dir = join(DIST, site);
  return walk(dir)
    .filter((f) => f.endsWith('.html'))
    .map((file) => ({
      site,
      file,
      rel: relative(dir, file),
      root: parse(readFileSync(file, 'utf8'), { comment: false }),
    }));
}

export class Report {
  private errors: string[] = [];
  error(msg: string): void {
    this.errors.push(msg);
  }
  finish(name: string): void {
    if (this.errors.length) {
      console.error(`✗ ${name}: ${this.errors.length} problem(s)`);
      for (const e of this.errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log(`✓ ${name}`);
  }
}
