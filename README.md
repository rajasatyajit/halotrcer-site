# halotrcer-site

Static sites for www.halotrcer.com, tokvera.halotrcer.com and sievant.halotrcer.com: one Astro codebase, three builds, three Cloudflare Pages projects. See PLAN.md for the design and CLAUDE.md for the working rules.

## Commands

| Command                                           | What                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                   | Build all three sites into `dist/<site>`                                                                          |
| `npm run build -- --site www`                     | Build one site (what each Pages project runs)                                                                     |
| `SITE_ID=tokvera npm run dev`                     | Dev server for one site                                                                                           |
| `npm run typecheck` / `npm run lint` / `npm test` | Types, lint and format, unit tests                                                                                |
| `npm run check:dist`                              | HTML validation, headers and CSP, claim scan, budgets (after a build)                                             |
| `npm run check:prelaunch`                         | No install commands, versions or GitHub links (after a `LAUNCHED=false` build)                                    |
| `npm run verify:claims`                           | Re-read every claim's quote from the product repos (local only; read-only)                                        |
| `npm run sync:docs` / `npm run sync:releases`     | Copy docs, install commands and install scripts from the product repos at the refs in `config/` (read-only)       |
| `npm run sync:samples`                            | Copy sample reports and the OWASP mapping from the product repos at the refs in `config/samples.json` (read-only) |
| `npm run verify:scripts`                          | Vendored install scripts are byte-identical to the pinned refs (local only)                                       |
| `npm run build:launched-fixture`                  | Launched-mode build with fake `v0.0.0-fixture` release data, for tests                                            |
| `npm run check:launched`                          | Every channel present and resolved, scripts byte-identical (after a launched build)                               |
| `npm run check:links` / `npm run check:seo`       | Internal and cross-host links; SEO basics, sitemaps, llms.txt (after building all sites)                          |
| `npm run check:permanence`                        | Every URL in `data/published-urls.json` is still served or redirected, and every sitemap URL is recorded          |
| `npm run urls:record`                             | Record new sitemap URLs (run after a pre-launch build, then after a launched build; adds only)                    |
| `PW_CHROMIUM=/usr/bin/chromium npm run e2e`       | Browser tests (axe, picker, no-JS) against the built sites                                                        |

## Build flags

| Variable            | Default | Effect                                                                                                       |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `SITE_ID`           | (all)   | `www`, `tokvera` or `sievant`                                                                                |
| `LAUNCHED`          | `false` | Show install commands, versions and GitHub links                                                             |
| `INSTALL_ENDPOINTS` | `false` | Serve `/install.sh` and `/install.ps1`                                                                       |
| `ANALYTICS`         | `false` | Cloudflare Web Analytics beacon                                                                              |
| `RELEASE_DATA_DIR`  | (fetch) | Release data directory; launched builds otherwise fetch the latest releases, falling back to `data/releases` |
