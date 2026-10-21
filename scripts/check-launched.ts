// Launched-mode check: every channel of every released product appears, fully
// resolved, on www /install and on its own home page; no placeholder survives;
// and each served install script matches the release data's SHA-256.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SiteId } from '../src/config/site.ts';
import {
  loadRelease,
  PRODUCT_IDS,
  resolve,
  type Arch,
  type PlatformOs,
} from '../src/lib/releases.ts';
import { builtSites, DIST, pages, Report } from './lib/dist.ts';

const report = new Report();
if (process.env.LAUNCHED !== 'true') {
  console.error('check-launched must run against a LAUNCHED=true build');
  process.exit(2);
}

const HOME: Record<string, SiteId> = { halotrcer: 'www', tokvera: 'tokvera', sievant: 'sievant' };
const sites = new Set(builtSites());
const textOf = (site: SiteId, rel: string) => {
  const page = pages(site).find((p) => p.rel === rel);
  return page
    ? page.root
        .querySelectorAll('code')
        .map((c) => c.textContent)
        .join('\n')
    : undefined;
};

const variants: { arch: Arch; os?: PlatformOs }[] = [
  { arch: 'x64' },
  { arch: 'arm64' },
  ...(['linux', 'darwin', 'windows'] as const).flatMap((os) =>
    (['x64', 'arm64'] as const).map((arch) => ({ arch, os })),
  ),
];

let checked = 0;
for (const product of PRODUCT_IDS) {
  const data = loadRelease(product);
  if (!data?.release) {
    console.log(`${product}: no release; shows Launching soon`);
    continue;
  }
  const targets: [SiteId, string][] = [
    ['www', 'install.html'],
    [HOME[product] ?? 'www', 'index.html'],
  ];
  for (const [site, rel] of targets) {
    if (!sites.has(site)) continue;
    const html = textOf(site, rel);
    if (html === undefined) {
      report.error(`${site}/${rel} missing`);
      continue;
    }
    if (/\{(tag|version|apkArch|platform)\}/.test(html))
      report.error(`${site}/${rel}: unresolved placeholder`);
    for (const c of data.channels) {
      const usesPlatform = c.commands.some((t) => t.includes('{platform}'));
      const usesArch = c.commands.some((t) => t.includes('{apkArch}'));
      const vs = usesPlatform
        ? variants.filter((v) => v.os)
        : usesArch
          ? variants.filter((v) => !v.os)
          : [{ arch: 'x64' as Arch }];
      for (const v of vs) {
        for (const cmd of c.commands) {
          const resolved = resolve(cmd, data.release, v);
          checked++;
          if (!html.includes(resolved))
            report.error(`${site}/${rel}: ${product} ${c.id} missing: ${resolved.split('\n')[0]}`);
        }
      }
    }
  }
  const site = HOME[product] ?? 'www';
  for (const [name, meta] of Object.entries(data.scripts)) {
    if (!sites.has(site)) continue;
    const file = join(DIST, site, name);
    if (!existsSync(file)) {
      report.error(`${site}/${name} not served`);
      continue;
    }
    const sha = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (sha !== meta.sha256)
      report.error(`${site}/${name}: sha256 ${sha} != release data ${meta.sha256}`);
  }
}

report.finish(`launched mode (${checked} commands present and resolved, scripts byte-identical)`);
