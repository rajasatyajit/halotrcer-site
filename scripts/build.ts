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

for (const site of targets) {
  console.log(`\n== building ${site}`);
  const res = spawnSync('npx', ['astro', 'build'], {
    stdio: 'inherit',
    env: { ...process.env, SITE_ID: site },
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}
