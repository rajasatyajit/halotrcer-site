# halotrcer-site

Static sites for www.halotrcer.com, tokvera.halotrcer.com and sievant.halotrcer.com: one Astro codebase, three builds, three Cloudflare Pages projects. See PLAN.md for the design and CLAUDE.md for the working rules.

## Commands

| Command                                           | What                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run build`                                   | Build all three sites into `dist/<site>`                                       |
| `npm run build -- --site www`                     | Build one site (what each Pages project runs)                                  |
| `SITE_ID=tokvera npm run dev`                     | Dev server for one site                                                        |
| `npm run typecheck` / `npm run lint` / `npm test` | Types, lint and format, unit tests                                             |
| `npm run check:dist`                              | HTML validation, headers and CSP, claim scan, budgets (after a build)          |
| `npm run check:prelaunch`                         | No install commands, versions or GitHub links (after a `LAUNCHED=false` build) |
| `npm run verify:claims`                           | Re-read every claim's quote from the product repos (local only; read-only)     |

## Build flags

| Variable            | Default | Effect                                           |
| ------------------- | ------- | ------------------------------------------------ |
| `SITE_ID`           | (all)   | `www`, `tokvera` or `sievant`                    |
| `LAUNCHED`          | `false` | Show install commands, versions and GitHub links |
| `INSTALL_ENDPOINTS` | `false` | Serve `/install.sh` and `/install.ps1`           |
| `ANALYTICS`         | `false` | Cloudflare Web Analytics beacon                  |
