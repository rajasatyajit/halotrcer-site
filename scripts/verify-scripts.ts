// Local, read-only: each vendored install script must equal, byte for byte, the
// file in its product repo at the ref pinned in config/release-refs.json, and
// match the SHA-256 recorded in data/releases.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCTS } from '../config/install-channels.ts';
import { loadRelease, PRODUCT_IDS } from '../src/lib/releases.ts';
import { Report } from './lib/dist.ts';
import { sha256 } from './lib/release-data.ts';
import { resolveRef, showFileBytes } from './lib/repos.ts';

const refs = JSON.parse(readFileSync('config/release-refs.json', 'utf8')) as Record<
  string,
  { ref: string; status: string; scripts: Record<string, string> }
>;
const report = new Report();
let n = 0;
for (const product of PRODUCT_IDS) {
  const entry = refs[product];
  if (!entry) continue;
  const commit = resolveRef(PRODUCTS[product].repo, entry.ref);
  const data = loadRelease(product, join('data', 'releases'));
  for (const [name, path] of Object.entries(entry.scripts)) {
    const upstream = showFileBytes(PRODUCTS[product].repo, commit, path);
    const vendored = readFileSync(join('vendor', 'install', product, name));
    if (!upstream.equals(vendored))
      report.error(`${product}/${name}: differs from ${path} at ${commit.slice(0, 7)}`);
    if (data?.scripts[name]?.sha256 !== sha256(vendored))
      report.error(`${product}/${name}: data/releases sha256 is stale`);
    n++;
  }
  console.log(`${product}: ${entry.status} @ ${commit.slice(0, 7)}`);
}
report.finish(`install scripts (${n} byte-identical to their pinned refs)`);
