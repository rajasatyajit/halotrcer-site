// Test fixtures for launched-mode builds: the committed release data with a
// clearly fake release (v0.0.0-fixture). Written to .cache/, never committed or
// shipped. Usage: node scripts/fixture-releases.ts && RELEASE_DATA_DIR=.cache/fixture-releases LAUNCHED=true npm run build
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCT_IDS, releaseDataSchema } from '../src/lib/releases.ts';

export const FIXTURE_DIR = join('.cache', 'fixture-releases');
export const FIXTURE_RELEASE = {
  tag: 'v0.0.0-fixture',
  version: '0.0.0-fixture',
  published: '2026-01-01T00:00:00Z',
  url: 'https://example.invalid/fixture',
};

mkdirSync(FIXTURE_DIR, { recursive: true });
for (const product of PRODUCT_IDS) {
  const data = releaseDataSchema.parse(
    JSON.parse(readFileSync(join('data', 'releases', `${product}.json`), 'utf8')),
  );
  writeFileSync(
    join(FIXTURE_DIR, `${product}.json`),
    JSON.stringify({ ...data, release: FIXTURE_RELEASE }, null, 2),
  );
}
console.log(`fixtures: ${FIXTURE_DIR}`);
