// Builds one of the three sites per run: injects only that site's routes from
// src/sites/<site>/pages and writes its _headers and _redirects.
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { Flags } from '../src/config/flags.ts';
import { BOOKING_TARGET } from '../src/config/site.ts';
import { headersFile } from '../src/config/headers.ts';
import { redirectsFile } from '../src/data/redirects.ts';
import { copyEndpoints, endpointsFor } from './endpoints.ts';

const ROUTE_FILE = /\.(astro|ts|md|mdx)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// "index.astro" -> "/", "docs/index.astro" -> "/docs", "robots.txt.ts" -> "/robots.txt"
export function routePattern(relPath: string): string {
  const noExt = relPath.split(sep).join('/').replace(ROUTE_FILE, '');
  const trimmed = noExt === 'index' ? '' : noExt.replace(/\/index$/, '');
  return `/${trimmed}`;
}

export function sitesIntegration(flags: Flags): AstroIntegration {
  return {
    name: 'halotrcer-sites',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, logger }) => {
        const root = fileURLToPath(config.root);
        const pagesDir = join(root, 'src', 'sites', flags.site, 'pages');
        for (const file of walk(pagesDir).filter((f) => ROUTE_FILE.test(f))) {
          const pattern = routePattern(relative(pagesDir, file));
          // /book is a redirect once the booking tool is set; the page is the fallback.
          if (pattern === '/book' && BOOKING_TARGET) continue;
          injectRoute({ pattern, entrypoint: file, prerender: true });
        }
        logger.info(`site=${flags.site} launched=${flags.launched}`);
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const endpoints = endpointsFor(flags);
        copyEndpoints(endpoints, out);
        for (const e of endpoints)
          logger.info(`serving /${e.name} (sha256 ${e.sha256.slice(0, 12)})`);
        writeFileSync(
          join(out, '_headers'),
          headersFile(
            flags,
            endpoints.map((e) => `/${e.name}`),
          ),
        );
        writeFileSync(join(out, '_redirects'), redirectsFile(flags.site));
      },
    },
  };
}
