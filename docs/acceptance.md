# Acceptance

Every requirement in the brief, what enforces it, and its state at the end of M7. "CI" means
`.github/workflows/ci.yml` on every push unless a row says otherwise. Rows marked **manual** need
the deployed sites or the owner and are not claimed as done.

Last full green CI: run 39638677403 (`m7-hardening` 91f318f, manual run, 21 of 21 jobs:
Lighthouse, and the browser tests in Chromium, Firefox and WebKit, both modes).

## Hosts, products and content

| Requirement                                                                     | Enforced by                                                                                  | State                         |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------- |
| www, tokvera and sievant from one project; product sites are canonical homes    | `SITE_ID` builds, `check:seo` (canonical on the page's own host), `check:links` (cross-host) | ✅ CI                         |
| Apex 301 to www                                                                 | Cloudflare Redirect Rule (PLAN.md §16)                                                       | **manual** (owner, at deploy) |
| Product facts only from the product repos                                       | `content/claims.yaml` + `<Claim>`, `npm run verify:claims` (73 quotes), claim scan in CI     | ✅ CI + local                 |
| No invented customers, logos, testimonials, counts, benchmarks or savings       | `check:claims` on every page; calculator never says savings (unit + e2e)                     | ✅ CI                         |
| Proof sections from `content/proof/*.md`, nothing when empty                    | `Proof` component, zod frontmatter (source, permission), `check:claims` proof rules          | ✅ CI (folder empty)          |
| Paid services and prices from one file                                          | `content/pricing.md` (`source: owner`), Service JSON-LD prices checked against it            | ✅ CI                         |
| Contact email and `/book` as one constant, email fallback until Cal.com         | `src/config/site.ts`; `/book` renders the fallback while `BOOKING_TARGET` is null            | ✅ (Cal.com link pending)     |
| Tokvera "Provisional scoring.", Halotrcer "Provisional.", Sievant OWASP wording | Rendered from synced docs and claims; checked by the claim registry                          | ✅ CI                         |
| Sitemap of pages (www, product sites, scoring, OWASP, blog, 404)                | `check:links`, `check:seo`, sitemaps exact to indexable pages                                | ✅ CI                         |
| Published URLs never break                                                      | `check:permanence` against `data/published-urls.json` (both modes)                           | ✅ CI                         |

## Modes and install

| Requirement                                                                          | Enforced by                                                                             | State                                    |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `LAUNCHED=false`: no install commands, versions, GitHub links or star buttons        | `check:prelaunch` on every pre-launch build                                             | ✅ CI                                    |
| `LAUNCHED=true`: everything from release data                                        | `check:launched` (every channel present and resolved) on fixture release data           | ✅ CI                                    |
| Install picker: product switch, channels, OS/arch detection, hash over storage, copy | `tests/e2e/picker.spec.ts` (platform matrix, keyboard, hash, persistence, copy, no-JS)  | ✅ CI (Chromium; Firefox/WebKit on main) |
| Install endpoints byte-identical, `text/plain`, short cache, SHA-256 on `/install`   | `verify:scripts` (local), `check:launched`, `check:live` (wrangler: bytes, type, cache) | ✅ CI + local; refs are placeholders     |
| Scripts pinned to release-candidate commits                                          | `config/release-refs.json`; the build refuses `candidate` refs                          | **pending** owner's RC commits           |

## Performance, security, accessibility

| Requirement                                                               | Enforced by                                                                                                                                                                                                                                                                                                                                                                       | State                                           |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Lighthouse 100/100/100/100 (mobile) on key pages                          | LHCI, 3 hosts × 2 modes                                                                                                                                                                                                                                                                                                                                                           | ✅ CI                                           |
| LCP < 1.4 s (median of 3 runs), CLS 0, INP < 100 ms                       | LHCI, 3 runs per page, LCP asserted on the median. Limit 1.4 s (owner, 2026-10-23): the Marker font puts simulated LCP on a 1.21 / 1.36 / 1.51 s step; 30 runs after subsetting were all ≤ 1.36 s, so 1.4 s passes the current font and still fails if it adds another step. CLS and TBT (the lab proxy for INP) on the best run; Playwright interaction timing on the calculator | ✅ CI                                           |
| JS ≤ 20 KB gz per page, page ≤ 250 KB, one request per island             | `npm run budget` (also Pagefind: 24.4 KB JS at first search, cap 60 KB)                                                                                                                                                                                                                                                                                                           | ✅ CI                                           |
| Strict CSP (no unsafe-inline/eval), HSTS preload, nosniff, referrer, etc. | `check:headers` (static), `check:live` against Cloudflare's runtime (wrangler 4.148.0, both modes)                                                                                                                                                                                                                                                                                | ✅ CI + local                                   |
| `'wasm-unsafe-eval'` only on docs and search                              | `check:headers` (docs CSP = site CSP + that source); `check:live` (one CSP header there, none elsewhere)                                                                                                                                                                                                                                                                          | ✅ CI + local                                   |
| Security A+ on the deployed hosts                                         | `npm run check:live` against the hosts; Mozilla Observatory / securityheaders.com                                                                                                                                                                                                                                                                                                 | **manual** after deploy                         |
| WCAG 2.2 AA                                                               | axe on every key page, light and dark; keyboard tests for the picker                                                                                                                                                                                                                                                                                                              | ✅ CI (automated subset); manual review advised |
| Works with JavaScript disabled                                            | no-JS render tests per key page; picker `<details>`; calculator shows the formula                                                                                                                                                                                                                                                                                                 | ✅ CI                                           |
| No third-party scripts, fonts or trackers; analytics off                  | CSP `'self'`, LHCI third-party count 0, no font file but the self-hosted Permanent Marker subset (budget), `ANALYTICS` defaults off                                                                                                                                                                                                                                               | ✅ CI                                           |
| Firefox and WebKit                                                        | `e2e-browsers` job on main and manual runs                                                                                                                                                                                                                                                                                                                                        | ✅ CI (run 39638677403, both modes)             |

## SEO and sharing

| Requirement                                                                                  | Enforced by                                                             | State                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| JSON-LD (Organization, WebSite, SoftwareApplication, Service, FAQ, breadcrumbs, BlogPosting) | `check:jsonld` (schemas, resolved @ids, prices, no ratings)             | ✅ CI                   |
| Sitemaps, robots, llms.txt                                                                   | `check:seo`                                                             | ✅ CI                   |
| RSS and Atom                                                                                 | `tests/unit/feeds.test.ts`; empty until a post is published             | ✅ CI                   |
| OG images, Web Share, three hero variants per host                                           | `check:seo` (1200×630 PNG per page), share e2e, `content/heroes/*.yaml` | ✅ CI                   |
| Calculator and "Is your MCP setup leaking?"                                                  | calculator e2e; `/scan` in axe and Lighthouse lists                     | ✅ CI                   |
| External links                                                                               | `check:external`, nightly workflow (GitHub links skipped until launch)  | ✅ local run (13 links) |
| Search Console                                                                               | owner                                                                   | **after launch**        |

## CI hardening

| Requirement                                                           | Enforced by                                              | State |
| --------------------------------------------------------------------- | -------------------------------------------------------- | ----- |
| Actions pinned by SHA, `contents: read`, `persist-credentials: false` | workflow files; reviewed in each milestone               | ✅    |
| `ubuntu-24.04`; self-hosted runner only while the repo is private     | `tests/unit/runner.test.ts` (every job, every workflow)  | ✅ CI |
| A self-hosted runner names any missing tool                           | `scripts/ci/runner-tools.sh` after checkout in every job | ✅ CI |

## Owner's manual steps

1. Cloudflare: three Pages projects, custom domains, the apex Redirect Rule, TLS settings (PLAN.md
   §16). Then run `npm run check:live` from a build of the deployed commit.
2. Release-candidate commits for Tokvera, Sievant and Halotrcer, then `INSTALL_ENDPOINTS=true`.
3. The Cal.com link for `BOOKING_TARGET`.
4. After employer approval and launch: `LAUNCHED=true`, Search Console, publishing the blog posts,
   and hstspreload.org once every subdomain serves HTTPS.
5. Before submitting to hstspreload.org:
   1. Turn on Cloudflare zone HSTS (SSL/TLS → Edge Certificates → HSTS): max-age at least 12
      months, includeSubDomains, preload. The apex 301 comes from a Cloudflare Redirect Rule, before
      Pages, so `_headers` cannot add the header there.
   2. Check that the apex 301 carries it:
      `curl -sI https://halotrcer.com/ | grep -i strict-transport-security` should show
      `max-age=31536000` or more, `includeSubDomains` and `preload`.
   3. Re-run `npm run check:live`. It compares HSTS on every page with `_headers` (2 years), so a
      zone value that replaces the site's header shows up there.
   4. Preload is hard to reverse: removal from the list takes months to reach browsers, and until
      then every subdomain of halotrcer.com must serve HTTPS or be unreachable.
