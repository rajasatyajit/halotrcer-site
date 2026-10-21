// Builds the Pagefind index for a product site's docs (pages marked
// data-pagefind-body), written to dist/<site>/pagefind/. Returns whether an
// index was built, so the docs CSP can allow its WebAssembly.
import { readdirSync, rmSync } from 'node:fs';
import type { AstroIntegrationLogger } from 'astro';
import { createIndex, close } from 'pagefind';
import type { Flags } from '../src/config/flags.ts';

export async function indexDocs(
  out: string,
  flags: Flags,
  logger: AstroIntegrationLogger,
): Promise<boolean> {
  if (flags.site === 'www') return false;
  const { index, errors } = await createIndex({});
  if (!index) throw new Error(`pagefind: ${errors.join('; ')}`);
  const added = await index.addDirectory({ path: out });
  if (added.errors.length) throw new Error(`pagefind: ${added.errors.join('; ')}`);
  await index.writeFiles({ outputPath: `${out}/pagefind` });
  await close();
  // Only the search API and its index ship; Pagefind's own UI and highlight
  // scripts are unused.
  for (const f of readdirSync(`${out}/pagefind`)) {
    if (/^pagefind-(ui|component-ui|modular-ui|highlight)/.test(f)) rmSync(`${out}/pagefind/${f}`);
  }
  logger.info(`pagefind: indexed ${added.page_count} docs pages`);
  return added.page_count > 0;
}
