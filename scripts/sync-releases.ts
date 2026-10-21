// Writes data/releases/<product>.json and vendor/install/<product>/ from the
// product repos at the refs in config/release-refs.json (read-only: git show).
// The result is the committed fallback; release is null until a release exists.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCTS } from '../config/install-channels.ts';
import { PRODUCT_IDS } from '../src/lib/releases.ts';
import { buildReleaseData } from './lib/release-data.ts';
import { resolveRef, showFile, showFileBytes } from './lib/repos.ts';

export interface RefEntry {
  ref: string;
  status: 'candidate' | 'rc';
  scripts: Record<string, string>;
}

export const loadRefs = () =>
  JSON.parse(readFileSync('config/release-refs.json', 'utf8')) as Record<string, RefEntry | string>;

const refs = loadRefs();
for (const product of PRODUCT_IDS) {
  const entry = refs[product];
  if (!entry || typeof entry === 'string')
    throw new Error(`config/release-refs.json: no entry for ${product}`);
  const spec = PRODUCTS[product];
  const commit = resolveRef(spec.repo, entry.ref);
  const read = (path: string) => showFile(spec.repo, commit, path);
  const scripts = Object.fromEntries(
    Object.entries(entry.scripts).map(([name, path]) => [
      name,
      { path, content: showFileBytes(spec.repo, commit, path) },
    ]),
  );
  const data = buildReleaseData({ spec, read, ref: entry.ref, commit, release: null, scripts });
  mkdirSync('data/releases', { recursive: true });
  writeFileSync(join('data/releases', `${product}.json`), JSON.stringify(data, null, 2) + '\n');
  const vendor = join('vendor', 'install', product);
  mkdirSync(vendor, { recursive: true });
  for (const [name, s] of Object.entries(scripts)) writeFileSync(join(vendor, name), s.content);
  console.log(
    `${product} @ ${commit.slice(0, 7)} (${entry.status}): ${data.channels.length} channels, scripts: ${Object.keys(scripts).join(', ') || 'none'}`,
  );
}
