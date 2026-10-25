# Acceptance

Every requirement in the brief, what enforces it, and its state at the end of M8. "CI" means
`.github/workflows/ci.yml` on every push unless a row says otherwise. Rows marked **manual** need
the deployed sites or the owner and are not claimed as done.

Last full green CI: run 40169288251 (`main` 9b3a836, push, 21 of 21 jobs: Lighthouse, and the
browser tests in Chromium, Firefox and WebKit, both modes).

## M8 acceptance

### On main (9b3a836, 2026-10-25)

`main` at 9b3a836 (merge of PR #3) holds M8: the redesign (PR #1, merge 91d8cc3), the copy fixes
(PR #2, merge 3b0ebfd) and the /agencies pre-launch share text (PR #3).

CI run 40169288251 (push): success, 21 of 21 jobs.

| Job                                    | Pre-launch                                                     | Launched                   |
| -------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| Types, lint, unit tests, audit         | pass (mode-independent)                                        |                            |
| Builds (www, tokvera, sievant)         | pass: HTML, headers/CSP, claims, budgets, stamps, Marker, glue | pass, and `check:launched` |
| Links and SEO across all hosts         | pass                                                           | pass                       |
| Chromium (axe and browser tests)       | 301 passed, 22 skipped (picker tests need a launched build)    | 323 passed                 |
| Firefox                                | 301 passed, 22 skipped                                         | 323 passed                 |
| WebKit                                 | 301 passed, 22 skipped                                         | 323 passed                 |
| Lighthouse (3 hosts, 23 pages, 3 runs) | pass                                                           | pass                       |

Lighthouse: 100/100/100/100 on every page in both modes, except SEO on the two `noindex` pages
(404, /book), which is off by config. CLS 0 and TBT 0 ms on every run. LCP medians of 3 runs, all
under the 1.4 s limit; the highest median is 1.37 s (tokvera/, launched), and no single run was
above 1.37 s:

| Page                       | LCP median, pre-launch | LCP median, launched |
| -------------------------- | ---------------------- | -------------------- |
| www/                       | 1.36 s                 | 1.36 s               |
| www/404                    | 1.21 s                 | 1.36 s               |
| www/agencies               | 1.36 s                 | 1.21 s               |
| www/audit                  | 1.36 s                 | 1.36 s               |
| www/blog                   | 1.21 s                 | 1.21 s               |
| www/book                   | 1.21 s                 | 1.21 s               |
| www/calculator             | 1.36 s                 | 1.36 s               |
| www/install                | 1.36 s                 | 1.21 s               |
| www/pricing                | 1.36 s                 | 1.21 s               |
| www/scoring                | 1.21 s                 | 1.21 s               |
| www/security               | 1.21 s                 | 1.21 s               |
| tokvera/                   | 1.36 s                 | 1.37 s               |
| tokvera/404                | 1.36 s                 | 1.36 s               |
| tokvera/calculator         | 1.21 s                 | 1.36 s               |
| tokvera/docs/scan          | 1.36 s                 | 1.36 s               |
| tokvera/sample-report      | 1.36 s                 | 1.36 s               |
| tokvera/scoring            | 1.21 s                 | 1.21 s               |
| sievant/                   | 1.36 s                 | 1.36 s               |
| sievant/404                | 1.36 s                 | 1.22 s               |
| sievant/docs/scan-and-wrap | 1.36 s                 | 1.36 s               |
| sievant/owasp-llm-top-10   | 1.36 s                 | 1.36 s               |
| sievant/sample-report      | 1.36 s                 | 1.36 s               |
| sievant/scan               | 1.36 s                 | 1.23 s               |

Cloudflare Pages production deployments of 9b3a836, all "Deployed successfully": halotrcer-www
94836103, halotrcer-tokvera e514803d, halotrcer-sievant e8658e84. www, tokvera and sievant
.halotrcer.com return 200 in pre-launch mode and serve the same stylesheet as those deployments.
www.halotrcer.com/agencies serves the pre-launch description and `og:description` "Once
released, run Tokvera and Sievant for your clients: name the client in the Sievant report and
leave our call-to-action footers out. Talk to us about referrals."

### Local run (`m8-redesign`, 0ab89b1, before merge)

The Case File redesign (docs/redesign/DESIGN.md, plan
docs/superpowers/plans/2026-10-23-m8-case-file.md). Run locally on 2026-10-23, every run started
at a 1-minute load average below 1.0. Pre-launch is `npm run build:prelaunch`; launched is
`npm run build:launched-fixture` with `LAUNCHED=true`, as in CI.

### Lighthouse (mobile; `lhci autorun` with `lighthouserc.cjs`, 3 runs per page)

Gate: 100 in all four categories, LCP median of 3 runs < 1.4 s, CLS 0, TBT < 100 ms, JS
≤ 20 KB, page ≤ 250 KB, no third-party requests. All 46 page runs passed (exit 0); CLS 0 and
TBT 0 ms on every run. Scores are performance/accessibility/best practices/SEO; SEO is off by
config on the two `noindex` pages (404, /book).

| Page                       | LCP median, pre-launch | LCP median, launched | Scores, pre-launch        | Scores, launched          |
| -------------------------- | ---------------------- | -------------------- | ------------------------- | ------------------------- |
| www/                       | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| www/404                    | 1.21 s                 | 1.36 s               | 100/100/100/off (noindex) | 100/100/100/off (noindex) |
| www/agencies               | 1.21 s                 | 1.21 s               | 100/100/100/100           | 100/100/100/100           |
| www/audit                  | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| www/blog                   | 1.21 s                 | 1.21 s               | 100/100/100/100           | 100/100/100/100           |
| www/book                   | 1.21 s                 | 1.21 s               | 100/100/100/off (noindex) | 100/100/100/off (noindex) |
| www/calculator             | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| www/install                | 1.21 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| www/pricing                | 1.21 s                 | 1.21 s               | 100/100/100/100           | 100/100/100/100           |
| www/scoring                | 1.21 s                 | 1.21 s               | 100/100/100/100           | 100/100/100/100           |
| www/security               | 1.21 s                 | 1.21 s               | 100/100/100/100           | 100/100/100/100           |
| tokvera/                   | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| tokvera/404                | 1.21 s                 | 1.36 s               | 100/100/100/off (noindex) | 100/100/100/off (noindex) |
| tokvera/calculator         | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| tokvera/docs/scan          | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| tokvera/sample-report      | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| tokvera/scoring            | 1.21 s                 | 1.21 s               | 100/100/100/100           | 100/100/100/100           |
| sievant/                   | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| sievant/404                | 1.21 s                 | 1.36 s               | 100/100/100/off (noindex) | 100/100/100/off (noindex) |
| sievant/docs/scan-and-wrap | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| sievant/owasp-llm-top-10   | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| sievant/sample-report      | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |
| sievant/scan               | 1.36 s                 | 1.36 s               | 100/100/100/100           | 100/100/100/100           |

Margin: with Permanent Marker, simulated LCP lands on a 1.21 / 1.36 / 1.51 s step. Most pages
now sit on the 1.36 s step, 40 ms under the 1.4 s limit (docs/fonts.md).

### Checks

| Gate                                                                        | Pre-launch                                                                       | Launched                                                                                                                 | Commit  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- |
| Unit tests (Vitest)                                                         | 364 passed                                                                       | (mode-independent)                                                                                                       | 0ab89b1 |
| Lint (ESLint, Stylelint, Prettier), typecheck                               | pass                                                                             | pass                                                                                                                     | 0ab89b1 |
| HTML, headers/CSP, claims scan, SEO, JSON-LD                                | pass                                                                             | pass                                                                                                                     | 0ab89b1 |
| Stamps (`check:stamps`, every sample frame and clue card, no empty stamp)   | pass                                                                             | pass                                                                                                                     | 0ab89b1 |
| Marker glyphs (`check:marker`)                                              | pass                                                                             | pass                                                                                                                     | 0ab89b1 |
| Budgets (`npm run budget`)                                                  | largest JS 2.5 KB gz (www/calculator), largest page 34.2 KB (sievant/docs/audit) | largest JS 3.7 KB gz (sievant/scan), largest page 48.2 KB (sievant/docs/gateway); docs search 24.4 KB JS at first search | 0ab89b1 |
| Pre-launch rules (`check:prelaunch`) / launched channels (`check:launched`) | pass                                                                             | pass (126 commands present, scripts byte-identical)                                                                      | 0ab89b1 |
| Internal links, URL permanence (63 URLs, incl. the sample JSON download)    | pass                                                                             | pass                                                                                                                     | 0ab89b1 |
| Claim sources (`verify:claims`)                                             | 77 quotes verified                                                               |                                                                                                                          | 0ab89b1 |
| External links (`check:external`)                                           | 23 links OK                                                                      |                                                                                                                          | 3f8158e |

### Browsers (full Playwright suite: axe in both themes, no-JS, keyboard, board, fonts, layout at 320 px, email wrapping, text blocks, calculator, picker, docs)

| Browser  | Pre-launch                                                                                                                         | Launched           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Chromium | 294 passed, 22 skipped (picker tests need a launched build)                                                                        | 316 passed         |
| Firefox  | 294 passed, 22 skipped                                                                                                             | 316 passed         |
| WebKit   | **not run**: WebKit does not launch on this machine (host lacks libicu74 and libflite1; Arch Linux). CI on main passes it (above). | **not run** (same) |

### Picker behaviour and honesty

- Install picker (launched only): picker spec passes in Chromium and Firefox; commands wrap on
  phones and copy exactly.
- No fabricated claims: claims scan on every page; every board figure and every number in a
  clue sentence is derived from `content/samples/*.json` (`board-numbers.test.ts`, including a
  mutation test); every clue card and sample frame carries "Simulated demo run".

### Owner's manual steps

- Done: `m8-redesign`, `m8-copy-fixes` and `m8-share-text` merged to `main` (9b3a836); CI is
  green there, including WebKit.
- Nothing new on DNS, Pages projects, the booking link or Search Console.

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
| Firefox and WebKit                                                        | `e2e-browsers` job on main and manual runs                                                                                                                                                                                                                                                                                                                                        | ✅ CI (run 40169288251, both modes)             |

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
