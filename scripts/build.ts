// npm run build                 -> all three sites
// npm run build -- --site www   -> one site (what each Cloudflare Pages project runs)
// SITE_ID=www npm run build     -> same, for environments that set variables instead of args
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { SITES, type SiteId } from '../src/config/site.ts';

const { values } = parseArgs({ options: { site: { type: 'string' } } });
const requested = values.site ?? process.env.SITE_ID;

if (requested && !(SITES as readonly string[]).includes(requested)) {
  console.error(`Unknown site "${requested}". Expected one of: ${SITES.join(', ')}`);
  process.exit(2);
}

const targets: readonly SiteId[] = requested ? [requested as SiteId] : SITES;

// Launched builds read release data fetched now from GitHub (committed data as
// the per-product fallback), unless RELEASE_DATA_DIR points elsewhere (tests).
const env = { ...process.env };
if (env.LAUNCHED === 'true' && !env.RELEASE_DATA_DIR) {
  const { fetchAll, CACHE } = await import('./fetch-releases.ts');
  const n = await fetchAll();
  if (n === 0) console.warn('release: no release fetched; every product will show Launching soon');
  env.RELEASE_DATA_DIR = CACHE;
}

for (const site of targets) {
  console.log(`\n== building ${site}`);
  const res = spawnSync('npx', ['--no-install', 'astro', 'build'], {
    stdio: 'inherit',
    env: { ...env, SITE_ID: site },
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}
