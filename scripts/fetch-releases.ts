// Run by scripts/build.ts when LAUNCHED=true (and RELEASE_DATA_DIR is unset).
// Writes .cache/releases/<product>.json and .cache/releases/scripts/<product>/*.
// A product whose fetch fails falls back to the committed data/releases file,
// so it shows "Launching soon" instead of stale commands.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCT_IDS } from '../src/lib/releases.ts';
import { fetchRelease } from './lib/fetch-release.ts';

export const CACHE = join('.cache', 'releases');

export async function fetchAll(): Promise<number> {
  const refs = JSON.parse(readFileSync('config/release-refs.json', 'utf8')) as Record<
    string,
    { scripts?: Record<string, string> }
  >;
  rmSync(CACHE, { recursive: true, force: true });
  mkdirSync(CACHE, { recursive: true });
  let fetched = 0;
  for (const product of PRODUCT_IDS) {
    try {
      const { data, scripts } = await fetchRelease(product, refs[product]?.scripts ?? {});
      writeFileSync(join(CACHE, `${product}.json`), JSON.stringify(data, null, 2));
      const dir = join(CACHE, 'scripts', product);
      mkdirSync(dir, { recursive: true });
      for (const [name, buf] of Object.entries(scripts)) writeFileSync(join(dir, name), buf);
      console.log(`release: ${product} ${data.release?.tag} (${data.channels.length} channels)`);
      fetched++;
    } catch (e) {
      console.warn(
        `release: ${product} fetch failed (${(e as Error).message}); using committed data`,
      );
      copyFileSync(join('data', 'releases', `${product}.json`), join(CACHE, `${product}.json`));
    }
  }
  return fetched;
}
