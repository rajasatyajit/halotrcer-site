// Install script endpoints: /install.sh and /install.ps1 on each product's host
// (www serves the Halotrcer bundle's, once it has them). Served when
// INSTALL_ENDPOINTS=true or LAUNCHED=true. The bytes must match the release
// data's SHA-256, or the build fails.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Flags } from '../src/config/flags.ts';
import type { SiteId } from '../src/config/site.ts';
import { loadRelease, releaseDir, type ProductId } from '../src/lib/releases.ts';

export const PRODUCT_FOR_SITE: Record<SiteId, ProductId> = {
  www: 'halotrcer',
  tokvera: 'tokvera',
  sievant: 'sievant',
};

interface RefEntry {
  ref: string;
  status: 'candidate' | 'rc';
}

export interface Endpoint {
  name: string;
  from: string;
  sha256: string;
}

export function endpointsFor(flags: Flags, root = process.cwd()): Endpoint[] {
  if (!flags.installEndpoints && !flags.launched) return [];
  const product = PRODUCT_FOR_SITE[flags.site];
  const data = loadRelease(product);
  if (!data) throw new Error(`No release data for ${product}`);
  // Launched without a release for this product (e.g. the fetch failed): it
  // shows Launching soon, and serves no script.
  if (!flags.installEndpoints && !data.release) return [];
  const refs = JSON.parse(
    readFileSync(join(root, 'config', 'release-refs.json'), 'utf8'),
  ) as Record<string, RefEntry>;
  const out: Endpoint[] = [];
  for (const [name, meta] of Object.entries(data.scripts)) {
    const fetched = join(releaseDir(root), 'scripts', product, name);
    const vendored = join(root, 'vendor', 'install', product, name);
    const from = existsSync(fetched) ? fetched : vendored;
    if (
      from === vendored &&
      refs[product]?.status !== 'rc' &&
      process.env.ALLOW_CANDIDATE_SCRIPTS !== '1'
    ) {
      throw new Error(
        `${product}/${name}: config/release-refs.json pins a 'candidate' ref. Set the release-candidate commit and status 'rc' before serving install scripts (owner decision Q3).`,
      );
    }
    const sha256 = createHash('sha256').update(readFileSync(from)).digest('hex');
    if (sha256 !== meta.sha256) {
      throw new Error(
        `${product}/${name}: served bytes ${sha256} differ from release data ${meta.sha256}`,
      );
    }
    out.push({ name, from, sha256 });
  }
  return out;
}

export function copyEndpoints(endpoints: Endpoint[], outDir: string): void {
  for (const e of endpoints) copyFileSync(e.from, join(outDir, e.name));
}
