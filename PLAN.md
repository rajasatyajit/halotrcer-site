# Halotrcer website plan

Status: approved by the owner on 2026-10-21, with the decisions below. Where they differ from the rest of this plan, the decisions win.

## Owner decisions (2026-10-21)

| #                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 Hero              | Approved: "Find where your AI spend leaks and where your agents are exposed. One check. No telemetry, no account: it talks only to the endpoint you point it at."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Q2 Pricing           | Starting prices in USD, single source `content/pricing.md` (`source: owner`):<br>• AI Performance & Observability Audit (Tokvera): from $3,500, about 2 weeks. Instrumentation and dashboards left behind, ranked fix list, signed report, 60-minute walkthrough.<br>• Agent Security Review (Sievant): from $7,500, 1–2 weeks. Threat model, Sievant deployed (observe, then enforce), posture report for the client's customer security review, walkthrough.<br>• AI Cost & Security Audit (both): from $9,500, 2–3 weeks. Both of the above, one combined report.<br>• Founding-client offer: the first two clients get 50% off in exchange for a case study.<br>Service + Offer JSON-LD uses `priceSpecification.minPrice`. |
| Q3 Install endpoints | `INSTALL_ENDPOINTS` approved. Each product's scripts are pinned to the exact commit that will be tagged as its release candidate. The refs, one per product, live in one file, `config/release-refs.json`. `npm run verify:scripts` checks the served scripts byte for byte against `git show <ref>:scripts/install.{sh,ps1}` locally. CI checks the SHA-256 values recorded in that file.                                                                                                                                                                                                                                                                                                                                      |
| Q4 Samples           | Committed simulated reports only, labelled "Simulated demo run". Nothing is built or run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Q5 Sievant scoring   | Explain severities, `--fail-on` and the planned score (marked roadmap). No invented score.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Q6 Sievant speed     | If shown: "about 0.25 ms per call at p99" (README.md:21) is **proxy overhead**, from `TestProxyOverheadBudget` p99 overhead in BASELINE.md (medians about 217–248 µs across recorded runs; latest row BASELINE.md:428 median 248.1 µs), "measured on a development machine". `BenchmarkChain` (about 322–371 µs) is a different measurement (the policy chain) and isn't used as the per-call figure.                                                                                                                                                                                                                                                                                                                           |
| Q9 CSP               | No JSON-LD hashes. Global CSP; CI asserts every inline `<script>` is `application/ld+json`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Q10 Calculator       | Second output is "spend on repeated, uncached requests", from the reader's inputs, labelled an estimate, never called savings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Q11 Booking          | `/book` → 302 to the owner's Cal.com link. **The URL hasn't been supplied yet.** `BOOKING_TARGET` in `src/config/site.ts` stays `null`, and until it's set `/book` renders a contact page with the email instead of redirecting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Others               | Q7, Q8, Q12–Q17 as proposed in §15.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Evidence base: `research/facts-tokvera.md`, `research/facts-sievant.md`, `research/facts-halotrcer.md`. They are read-only surveys of the three product repos, and every fact in them cites `file:line`. Every product claim on the site must trace to one of those citations or to the product repo directly.

---

## 0. What the repos say today (constraints that shape the plan)

| Fact                                                                                                                                                                                                                                                                                                                                    | Source                                                                                       | Consequence for the site                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing is released. Tokvera and Sievant both have a local `v0.1.0` tag only; the first public release is planned as `v0.2.0`. Halotrcer has no tag and ships only after both tools reach v0.2.0. All repos are private.                                                                                                                | tokvera CHANGELOG, sievant README.md:24-26 and PLAN.md:837-849, halotrcer PLAN.md:20,273     | Pre-launch mode is the real default for weeks. Every `0.2.0` in the product docs is an example version and must never render as "latest".                 |
| **The Sievant and Tokvera release processes need this site live first.** `sievant.halotrcer.com/install.sh` and `/install.ps1` (and the Tokvera ones) must serve files byte-identical to `scripts/install.sh` and `scripts/install.ps1` before the release tag. The winget manifests use these hostnames as support and publisher URLs. | sievant docs/releasing.md:78-90 and PLAN.md:853-857; tokvera docs/releasing.md:84-92         | Install endpoints can't simply be gated on `LAUNCHED`. See open question Q3.                                                                              |
| `https://www.halotrcer.com/book` returns 404 today, but the report footers of all three products link to it.                                                                                                                                                                                                                            | sievant PLAN.md:853-857, halotrcer model.go:20-21, tokvera README.md:85-90                   | `/book` must ship in M1, in both modes.                                                                                                                   |
| The Halotrcer bundle has no `install.sh` or `install.ps1` yet (its milestone M3), and no Dockerfile, Helm chart, air-gapped bundle or docs/install.md.                                                                                                                                                                                  | halotrcer PLAN.md:172-190                                                                    | The bundle's picker shows only the channels its release data has. Missing channels are hidden, never shown as placeholders.                               |
| No repo has a price, scope or duration for any paid service. Of the three service names, only "AI Cost & Security Audit" appears in a repo (the bundle report CTA).                                                                                                                                                                     | all three fact sheets §7/§5/§8                                                               | `content/pricing.md` needs your figures. Until you supply them, the pricing page shows the scopes from the repos and "Priced on a call", with no numbers. |
| "Nothing leaves your machine" appears in no repo and is inaccurate: a Tokvera scan sends load to the target you give it, and keyless report signing writes to a public log.                                                                                                                                                             | tokvera product.go:30, halotrcer model.go:38-41                                              | The hero needs different wording. See Q1.                                                                                                                 |
| No real sample reports exist. The committed golden reports are synthetic: simulated targets and invented rates.                                                                                                                                                                                                                         | halotrcer testdata/fixtures/README.md:30, sievant pkg/report/testdata, tokvera testdata/demo | Every sample is labelled "Simulated demo run" and links to the file and command that produced it. See Q4.                                                 |
| Sievant has no grade or score yet; an A–F exposure score is a roadmap item.                                                                                                                                                                                                                                                             | sievant docs/roadmap.md:197-207                                                              | The Sievant "scoring" page explains severities, `--fail-on` and the roadmap item instead. See Q5.                                                         |
| Tokvera scoring is v0.9.0 and carries "**Provisional scoring.**". The bundle ranking model is v0.1.0 and carries "**Provisional.**" Both forbid savings estimates.                                                                                                                                                                      | tokvera docs/scoring.md:94, halotrcer docs/scoring.md:3-14,97                                | The labels are rendered verbatim. The site never states a savings figure. See Q10 for the calculator.                                                     |
| The Sievant README says "about 0.25 ms per call at p99", but its BASELINE.md shows about 322–348 µs.                                                                                                                                                                                                                                    | sievant README.md:20-22, BASELINE.md                                                         | No Sievant latency figure is shown until the repo reconciles the two. See Q6.                                                                             |

---

## 1. Hosting and the three hostnames

**Recommendation: one repository, one Astro codebase and one build script, three Cloudflare Pages projects.** Each project builds the same repo with a `SITE` variable and serves its own output directory:

| Pages project       | Build command                     | Output         | Custom domain           |
| ------------------- | --------------------------------- | -------------- | ----------------------- |
| `halotrcer-www`     | `npm run build -- --site www`     | `dist/www`     | `www.halotrcer.com`     |
| `halotrcer-tokvera` | `npm run build -- --site tokvera` | `dist/tokvera` | `tokvera.halotrcer.com` |
| `halotrcer-sievant` | `npm run build -- --site sievant` | `dist/sievant` | `sievant.halotrcer.com` |

Why not one project with host-based routing:

- Cloudflare Pages `_redirects` can't match on hostname, so host routing would need a Pages Function on every request. That means runtime code, cost and a cold path on a static site.
- Separate projects give each host its own `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`, `404.html` and root-level `/install.sh` with no special cases.
- One host can be redeployed or rolled back without touching the others.

The cost is three short builds per push (static Astro, about 30 s each). CI runs all three.

Apex `halotrcer.com` → `https://www.halotrcer.com` (301, path preserved) is a zone-level Cloudflare Redirect Rule, not part of Pages. This is a manual step for you.

Implementation:

- `src/sites/{www,tokvera,sievant}/pages/` hold each host's routes. A small Astro integration injects only the selected site's routes and sets `site` (used for canonical URLs, sitemaps and OG URLs).
- Shared layouts and components live in `src/components`. A `url(host, path)` helper builds every cross-host link, so no hostname is hand-typed in a template.
- `src/config/site.ts` holds the constants: hostnames, `BOOKING_URL` (single constant), `CONTACT_EMAIL = satyajit.rajaraman@halotrcer.com`, and the flags.

---

## 2. Build-time flags and data

| Flag                | Default | Effect                                                                                                                                                                                                                          |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LAUNCHED`          | `false` | `false`: no install commands, version numbers, GitHub links or star buttons anywhere; the `<LaunchingSoon>` block (booking link + email) appears instead. `true`: the picker, versions and repo links render from release data. |
| `INSTALL_ENDPOINTS` | `false` | Serves `/install.sh` and `/install.ps1` per host from pinned release data. It is separate from `LAUNCHED` because the product releases need the scripts live before the tag (Q3).                                               |
| `ANALYTICS`         | `false` | Adds the Cloudflare Web Analytics beacon and its CSP allowances (Q15).                                                                                                                                                          |

The flags are parsed once in `src/config/flags.ts` and validated with zod. A typo fails the build.

**Release data pipeline** (`scripts/sync-releases.ts`):

- **Private repos.** CI never needs access to the product repos. Data comes from two places:
  1. `npm run sync:local -- --tokvera <ref> --sievant <ref> --halotrcer <ref>`, run on this machine, reads the sibling repos read-only with `git show <ref>:<path>`, which never changes them. It writes `data/releases/<product>.json`, `vendor/install/<product>/install.{sh,ps1}`, `content/docs/<product>/*.md` and `data/sources.json` (the repo, ref and commit SHA of every synced file). The results are committed.
  2. With `LAUNCHED=true` and a `GITHUB_TOKEN` (optional, once the repos are public, no token needed), the build fetches `releases/latest` plus `checksums.txt` and overrides the committed fallback. If the fetch fails, the build falls back to the committed data and logs a warning. It never fails open to empty commands.
- `data/releases/<product>.json` schema: version, tag, published date, channels[] (id, platforms, command, next_command, verify steps, docs anchor) and install-script SHA-256s. Install commands are copied verbatim from each repo's `docs/install.md` (the bundle's from `internal/install/channels.go`). They are never retyped.
- `/install` on www publishes the SHA-256 of every served script.

---

## 3. Sitemap

### www.halotrcer.com

| Path                                                                               | Purpose                                                                                                                                                                                      | Notes                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                | The combined story: find the AI-spend leaks and agent exposures, one check, no telemetry                                                                                                     | Hero (3 variants in `content/heroes/www.md`), `halotrcer check` command and its documented terminal output (labelled simulated), two product cards, MCP CTA, calculator teaser, audit CTA, picker or `<LaunchingSoon>` |
| `/audit`                                                                           | AI Cost & Security Audit for CTOs and founders                                                                                                                                               | What the report contains (from the bundle report model), the 30-day fix plan structure (bundle scoring.md), what we don't claim, "Book a call"                                                                         |
| `/pricing`                                                                         | From `content/pricing.md`: fixed scopes for the three services                                                                                                                               | No figures until you supply them (Q2). Service + Offer JSON-LD emitted only when a price exists.                                                                                                                       |
| `/install`                                                                         | Picker for all three products + script SHA-256s                                                                                                                                              | Pre-launch: `<LaunchingSoon>` and what each tool will do                                                                                                                                                               |
| `/scoring`                                                                         | How Halotrcer ranks findings (tiers, deal risk, 30-day plan)                                                                                                                                 | "Provisional." label verbatim                                                                                                                                                                                          |
| `/calculator`                                                                      | AI bill leak calculator                                                                                                                                                                      | §6                                                                                                                                                                                                                     |
| `/security`                                                                        | Vulnerability disclosure (email, 5-business-day acknowledgement, from both SECURITY.md files), supply chain (cosign keyless, SLSA v1, SBOMs, signing-key fingerprint), site security headers | Also `/.well-known/security.txt`                                                                                                                                                                                       |
| `/about`                                                                           | Who builds this, Apache-2.0, how claims are sourced                                                                                                                                          | No invented team or history; you supply the bio (Q16)                                                                                                                                                                  |
| `/privacy`, `/terms`                                                               | Site privacy (no cookies, no trackers; analytics off) and terms                                                                                                                              | Drafts for your review, not legal advice                                                                                                                                                                               |
| `/blog`, `/blog/<slug>`                                                            | MDX; RSS `/blog/rss.xml`, Atom `/blog/atom.xml`                                                                                                                                              | Three outlines, marked draft, no results: (1) "Reading TTFT p95/p99 without fooling yourself", (2) "What an MCP config scan looks for", (3) "Why our scoring says provisional"                                         |
| `/book`                                                                            | 302 to `BOOKING_URL` via `_redirects`                                                                                                                                                        | 302 so the target can change                                                                                                                                                                                           |
| `/install.sh`, `/install.ps1`                                                      | Bundle scripts (when `INSTALL_ENDPOINTS` and the scripts exist)                                                                                                                              | `text/plain; charset=utf-8`, `Cache-Control: public, max-age=300`                                                                                                                                                      |
| `/404`                                                                             | Picker or `<LaunchingSoon>`, plus search links                                                                                                                                               |                                                                                                                                                                                                                        |
| `/sitemap-index.xml`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/llms-full.txt` | SEO                                                                                                                                                                                          | The index lists all three hosts' sitemaps                                                                                                                                                                              |

### tokvera.halotrcer.com

`/` (problem → what it measures → two-command quick start or `<LaunchingSoon>` → sample report → integrations → FAQ → audit CTA), `/sample-report`, `/scoring` (weights, bands, caps, "Provisional scoring." verbatim), `/calculator`, `/integrations` (GitHub Action, Helm, MCP server, Claude Code/Codex plugin, observability stack, caching proxy, supported servers), `/faq` (the 12 repo FAQ entries), `/docs/` + `/docs/<slug>`, `/install` (301 → `www…/install#tokvera`), `/install.sh`, `/install.ps1`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/404`.

### sievant.halotrcer.com

`/` (problem → what it blocks → scan/wrap/gateway modes → sample report → integrations → FAQ → review CTA), `/scan` ("Is your MCP setup leaking?" → `sievant scan` or `<LaunchingSoon>`), `/sample-report`, `/scoring` (Q5), `/owasp-llm-top-10` (the mapping table from docs/owasp-llm-mapping.md and `policy owasp`, with its "not a compliance certification…" wording verbatim and the "Not addressed" rows kept), `/integrations` (clients, connectors, MCP revisions), `/faq` (15 entries), `/docs/` + `/docs/<slug>`, `/install` (301 → www), `/install.sh`, `/install.ps1`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/404`.

**Docs excluded from rendering**: `releasing.md` (both), `development.md` (Sievant; linked to GitHub when launched), and Tokvera's `findings-schema-detail.md` (an internal prompt). Every docs page shows "Synced from rajasatyajit/<repo>@<short-sha>, docs/<file>". Internal links between repo docs are rewritten to site URLs; links to repo files become GitHub links when launched, plain text before.

**URL permanence**: `src/data/redirects.ts` is the single list of moved paths and generates each host's `_redirects` as 301s. A test fails if a path in the previous build's sitemap disappears without a redirect.

---

## 4. Design direction

**"Instrument panel, printed honestly."** These are measurement and security tools, so the site should read like a calibrated instrument, not a SaaS landing page: real commands, real output and plain labels.

- **Type**: system stack only (`system-ui` for text, `ui-monospace, SFMono-Regular, Menlo, Consolas` for code). No web font is shipped to browsers. One OFL font file is used only at build time to render OG images.
- **Colour**: near-neutral ink on paper (warm grey) for light mode, and deep graphite for dark. One signal colour per brand: Halotrcer indigo, Tokvera amber (latency and cost), Sievant teal (security). Severity colours (critical/high/medium/low/info) and grade colours (A–F) are tokens, always paired with a text label, never colour alone. All pairs are checked at ≥ 4.5:1 (≥ 3:1 for large text and UI) in both themes by a token contrast test.
- **Layout**: an 8 px grid, a 68ch measure for prose, and wide "terminal" panels for commands and output. The hero shows the command and the tool's documented output in a terminal panel that is real text, not an image. That keeps LCP text-based and the output copyable.
- **Motion**: almost none. A 150 ms fade for copy feedback and details disclosure, disabled under `prefers-reduced-motion`.
- **Themes**: `prefers-color-scheme` by default. The manual toggle is a progressive enhancement, persisted in localStorage (try/catch), and set before paint by a tiny external script (no inline script, because of CSP).
- **Brand**: a text wordmark only (Tokvera PLAN R21 says the same). Favicon: an SVG monogram per host.
- **Copy**: lead with the outcome, short sentences, concrete verbs, and show the command. Examples taken from the repos: "Find out where your LLM inference is slow, failing or expensive, in two commands." (Tokvera README); "Sievant puts a security checkpoint between AI agents and the tools they call." (Sievant README).

---

## 5. Components

| Component                                    | JS?             | Notes                                                                                                      |
| -------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `BaseLayout`                                 | –               | head, meta, canonical, OG, JSON-LD slot, skip link, theme                                                  |
| `SiteHeader` / `SiteFooter` / `HostSwitcher` | –               | cross-host navigation                                                                                      |
| `Hero`                                       | –               | reads the variant from `content/heroes/<host>.md` (variant A by default)                                   |
| `Terminal`                                   | –               | command + output, `aria-label`, "simulated" badge prop                                                     |
| `CopyButton`                                 | island (~1 KB)  | Clipboard API, `aria-live="polite"` feedback, hidden without JS                                            |
| `InstallPicker`                              | island (~5 KB)  | §7                                                                                                         |
| `LaunchingSoon`                              | –               | booking link + `mailto:`; the only install-area content in pre-launch                                      |
| `ProductCard`, `FeatureGrid`, `CTA`          | –               |                                                                                                            |
| `GradeScale`, `SeverityBadge`, `ScoreTable`  | –               | data from synced scoring docs                                                                              |
| `SampleReport`                               | –               | renders a committed report JSON as HTML, with download links (served as `Content-Disposition: attachment`) |
| `OwaspTable`                                 | –               | from synced mapping data                                                                                   |
| `FAQ`                                        | –               | `<details>` list + FAQPage JSON-LD                                                                         |
| `Calculator`                                 | island (~4 KB)  | §6; the form works without JS via GET submit to the same page (formula shown)                              |
| `ShareButton`                                | island (~1 KB)  | Web Share API, copy-link fallback                                                                          |
| `Proof`                                      | –               | renders `content/proof/*.md`; renders nothing when the folder is empty                                     |
| `DocsLayout`, `DocsNav`, `Search`            | Pagefind (lazy) | search JS loads only on focus or `/`                                                                       |
| `Breadcrumbs`                                | –               | + BreadcrumbList JSON-LD                                                                                   |
| `Claim`                                      | –               | wraps a sourced number or quote; see §9                                                                    |

---

## 6. AI bill leak calculator

- Inputs: monthly requests, average input tokens, average output tokens, input price per 1M, cached-input price per 1M, output price per 1M, and assumed cache-hit share of input (%).
- Formula, shown on the page in words and symbols:
  - `spend = R × (Tin × (1 − h) × Pin + Tin × h × Pcache + Tout × Pout) / 1,000,000`
  - `uncached-repeat spend = R × Tin × h × (Pin − Pcache) / 1,000,000`, labelled "what the cacheable share costs you at full input price, at your assumed hit rate".
- No default prices: the fields start empty, with an "Example inputs" button whose values are visibly labelled as an example. Nothing claims to be a real model's current price.
- The state encodes into the query string (`?r=…&tin=…`), so it works with no JS (GET form) and as a share link. "Copy result" copies a short summary + link.
- Label: "An estimate computed only from your inputs. Not a measurement. Run Tokvera to measure." The no-savings wording is Q10.

## 7. Install picker (LAUNCHED=true only)

- The product switch (Tokvera | Sievant | Halotrcer) and the channels come from `data/releases/*.json`. A channel with no command in the data is not rendered.
- **Server-rendered first**: every channel is a `<details>` block with the command, a one-line description, a "Verify" disclosure (sha256 + the cosign `verify-blob` command verbatim from the repo) and the next command. The island upgrades this to an ARIA tabs pattern (roving tabindex, arrow keys, Home/End).
- Detection, in `src/islands/install/detect.ts` (pure functions, unit tested): `navigator.userAgentData.platform` → `getHighEntropyValues(['architecture','bitness'])` where supported → `navigator.userAgent` fallback.
  - macOS → Homebrew, Windows → winget, Linux → install script, iOS/Android → a "copy link to install on your computer" note.
  - Arch matters only for direct downloads and air-gapped archives.
- Precedence: URL hash (`#tokvera/brew`) > localStorage (try/catch) > detection. Changing a tab updates the hash with `history.replaceState`.
- Next commands, from the repos:
  - Tokvera: `tokvera scan --demo`, then `tokvera scan --target URL --dry-run`.
  - Sievant: `sievant scan`, then `sievant wrap --all`.
  - Halotrcer: `halotrcer check --target <inference-url>`.

---

## 8. Technical SEO

- Unique `<title>` and description per page (a test checks uniqueness across all three hosts), canonical URLs, one H1 per page (test).
- JSON-LD, built from typed helpers (`schema-dts`):
  - Organization + WebSite on www with shared `@id`s (`https://www.halotrcer.com/#org`, `#website`), referenced from the product hosts.
  - SoftwareApplication per product. `offers` is free; `softwareVersion` and `downloadUrl` appear only when launched.
  - Service + Offer per paid service, only when `content/pricing.md` has a price.
  - BreadcrumbList, FAQPage, Article.
  - No `aggregateRating` and no review markup, ever.
- Per-host `sitemap.xml` and `robots.txt`; a sitemap index on www; RSS/Atom; `llms.txt` per host, linking the docs.
- Cross-linking: every product page links its sibling and the bundle; every docs page has "Used in Halotrcer check" where relevant; www links to the product scoring pages and the OWASP mapping.

**Keyword map**

| Keyword                  | Primary page                | Supporting                                  |
| ------------------------ | --------------------------- | ------------------------------------------- |
| LLM latency benchmark    | tokvera `/`                 | tokvera `/scoring`, blog #1                 |
| reduce LLM API cost      | www `/calculator`           | tokvera `/calculator`, www `/`              |
| vLLM performance tuning  | tokvera `/docs/scan`        | tokvera `/integrations`, `/faq`             |
| MCP security             | sievant `/`                 | sievant `/scan`, blog #2                    |
| MCP gateway open source  | sievant `/docs/gateway`     | sievant `/`, `/integrations`                |
| AI agent security review | www `/audit`                | sievant `/owasp-llm-top-10`, www `/pricing` |
| OWASP LLM Top 10 MCP     | sievant `/owasp-llm-top-10` | –                                           |
| LLM TTFT p99             | tokvera `/scoring`          | blog #1                                     |

---

## 9. Honesty enforcement

1. **Claim registry**: `content/claims.yaml`. Each entry has an id, the text or value, and a source (`repo`, `path`, `line` or exact quote, synced commit). The `<Claim id>` component renders it with `data-claim`.
2. **Built-HTML scan** (`scripts/check-claims.ts`, in CI): after the build, it extracts the visible text of every page, excluding `<code>`, `<pre>`, `data-claim`, `data-user-input` (calculator), `<time>` and the pricing block (which requires `source: owner` in `content/pricing.md`). The build fails on:
   - any remaining numeral pattern (`\d+(\.\d+)?\s?(%|x|ms|µs|s|k|M)`, `$\d`, "N customers/users/stars");
   - any capitalised org name from a deny-pattern list ("trusted by", "used by", "customers include").
3. **Quote drift check** (`npm run verify:claims`, local and pre-merge): re-reads each registry quote from the sibling repo at the recorded ref and fails if it no longer matches. CI checks that every entry has a complete source; only local runs can see the private repos.
4. `content/proof/*.md` require `source:` and `permission:` frontmatter (zod). The folder is empty, so the section renders nothing.
5. The pre-launch test (§10) asserts there is no `curl`, `irm`, `brew install`, `winget`, `scoop`, `apt`, `dnf`, `apk add`, `docker run`, `helm install`, `go install`, `github.com/rajasatyajit`, `v\d+\.\d+\.\d+` or star widget anywhere in `dist/` (HTML, XML, txt, JSON-LD).

---

## 10. CI (GitHub Actions)

All actions pinned by commit SHA; `permissions: contents: read`; `persist-credentials: false`; `runs-on: ubuntu-24.04`; npm `ci` with a lockfile; Node version pinned.

| Job          | What                                                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`      | matrix site × {LAUNCHED=false, LAUNCHED=true with fixture release data}; uploads `dist`                                                                                       |
| `check`      | `astro check` (types), ESLint, Stylelint, Prettier check                                                                                                                      |
| `html`       | `html-validate` on all built HTML                                                                                                                                             |
| `links`      | internal links on every build (incl. cross-host, resolved against the sibling `dist`); external links nightly + on PR, with the private GitHub URLs allow-listed until launch |
| `honesty`    | claim scan, registry completeness, proof frontmatter                                                                                                                          |
| `prelaunch`  | forbidden-pattern scan on `LAUNCHED=false` output; launched output has every channel in the data                                                                              |
| `seo`        | JSON-LD parse + validate against schema.org types and Google required properties (ajv schemas in `tests/jsonld/`), unique titles, one H1, canonical, sitemap ↔ pages          |
| `headers`    | parse each `dist/<site>/_headers` and assert the security policy (§11); assert no inline executable `<script>` and no `style=` attributes                                     |
| `e2e`        | Playwright (Chromium; WebKit and Firefox on main only): picker per mocked UA + arch, override, hash, persistence, copy, no-JS, calculator URL round-trip, theme               |
| `a11y`       | axe via Playwright on every key page, both themes                                                                                                                             |
| `lighthouse` | LHCI, mobile emulation, `assert` all four categories = 1.0, LCP < 1200 ms, CLS = 0, TBT as the INP proxy < 100 ms, script ≤ 20 KB gz, total ≤ 250 KB                          |
| `budget`     | `scripts/check-budgets.ts`: gzipped JS per page, page weight per page, from `dist` (fast, runs on every push)                                                                 |

Key pages for Lighthouse: www `/`, `/audit`, `/pricing`, `/install`, `/calculator`; tokvera `/`, `/scoring`, one docs page; sievant `/`, `/owasp-llm-top-10`, one docs page.

---

## 11. Security headers (`_headers`, all hosts)

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=(), clipboard-read=(), browsing-topics=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
X-Frame-Options: DENY
```

`clipboard-write` stays allowed for the copy buttons. The install scripts get `Content-Type: text/plain; charset=utf-8` and `Cache-Control: public, max-age=300`, and keep the site-wide `nosniff` and same-origin CORP: curl ignores CORP, and no page embeds the scripts cross-origin (decided in M3).

**JSON-LD and CSP**: `<script type="application/ld+json">` is a data block. Browsers don't execute it, so `script-src 'self'` doesn't block it and no hash is needed for it to work. You asked for hashes. Cloudflare Pages `_headers` allows 100 rules per project, so per-page header hashes don't scale. I recommend the global policy above plus a CI assertion that every inline `<script>` is `application/ld+json`. The alternative is a generated per-path CSP with SHA-256 hashes, kept within the 100-rule limit. See Q9.

Astro specifics: `build.inlineStylesheets: 'never'`, scripts emitted as external modules, `vite.build.assetsInlineLimit: 0`, and no `style=` attributes. The `headers` job enforces all of these.

---

## 12. Budgets

| Budget                | Target                                                                                        | Enforced by            |
| --------------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| Lighthouse P/A/BP/SEO | 100/100/100/100, mobile                                                                       | LHCI                   |
| LCP                   | < 1.2 s (mobile emulation)                                                                    | LHCI                   |
| CLS                   | 0                                                                                             | LHCI                   |
| INP                   | < 100 ms (TBT in lab, plus a Playwright interaction-timing test on the picker and calculator) | LHCI + e2e             |
| JS per page           | ≤ 20 KB gzipped (Pagefind counted at first search, separately capped at 60 KB)                | `check-budgets` + LHCI |
| Page weight           | ≤ 250 KB excluding a demo video                                                               | `check-budgets` + LHCI |
| CSS                   | one file per host, ≤ 20 KB gz (target)                                                        | `check-budgets`        |
| Fonts                 | 0 bytes shipped                                                                               | `headers`/`budget`     |
| Third-party requests  | 0 (1 beacon when `ANALYTICS=true`)                                                            | LHCI + CSP test        |

---

## 13. Milestones (one branch each, merged when gates pass)

| #   | Branch          | Scope                                                                                                                                                                                                                                                | Gates                                                      |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| M0  | `m0-plan`       | PLAN.md, CLAUDE.md, research/                                                                                                                                                                                                                        | your approval                                              |
| M1  | `m1-foundation` | Astro + TS scaffold, three-site build, flags, tokens + themes, BaseLayout/header/footer, `<LaunchingSoon>`, `/book`, `_headers`/`_redirects`, CI skeleton (build, check, html, headers, prelaunch, budget, honesty scaffold), placeholder home pages | all CI jobs green; Lighthouse 100 on the placeholder pages |
| M2  | `m2-www`        | www pages: home, audit, pricing, security, about, privacy, terms, 404, scoring; copy + hero variants; claim registry populated                                                                                                                       | + axe, seo, links                                          |
| M3  | `m3-install`    | release-data sync, fixture data, picker island, `/install`, install endpoints, SHA-256 publishing, Playwright picker suite                                                                                                                           | + e2e matrix; both modes tested                            |
| M4  | `m4-products`   | tokvera + sievant sites, docs sync + rendering + Pagefind, scoring pages, OWASP page, sample reports, integrations, FAQ                                                                                                                              | + LHCI on docs pages                                       |
| M5  | `m5-seo-share`  | JSON-LD everywhere, sitemaps/index, RSS/Atom, llms.txt, OG images, share button, cross-linking                                                                                                                                                       | + JSON-LD validation                                       |
| M6  | `m6-viral`      | calculator (www + tokvera), MCP "leaking?" CTA page, blog + 3 outlines                                                                                                                                                                               | + calculator e2e                                           |
| M7  | `m7-hardening`  | full Lighthouse/axe/Playwright runs across all browsers, external links, observatory dry-run against `wrangler pages dev` locally, acceptance table                                                                                                  | all acceptance rows green                                  |

Each milestone ends with an acceptance table and your manual steps.

---

## 14. Stack and dependencies (to be installed in M1, with your OK)

- Runtime: none shipped beyond the islands.
- Build: `astro`, `typescript`, `@astrojs/mdx`, `@astrojs/sitemap` (or a hand-written sitemap for per-host control), `zod`, `schema-dts` (types only), `pagefind`, `satori` + `@resvg/resvg-js` for OG images, `shiki` (Astro built-in, CSS-variable theme so there are no inline styles).
- Dev/CI: `eslint`, `typescript-eslint`, `stylelint`, `prettier`, `html-validate`, `linkinator`, `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`, `ajv`, `vitest`.
- The heavy ones are `@playwright/test` browsers (~400 MB if all three) and `@lhci/cli` (pulls Chrome via Puppeteer). Locally I'll install Chromium only, and I'll ask before installing them and before full runs.

---

## 15. Open questions (I need your answers before M1 or M2)

1. **Hero wording.** "Nothing leaves your machine" isn't true (a Tokvera scan sends load to your endpoint; keyless signing writes to a public log). Proposed: _"Find where your AI spend leaks and where your agents are exposed. One check. No telemetry, no account: it talks only to the endpoint you point it at."_ OK?
2. **Pricing.** No repo has prices, durations or deliverable lists beyond the report contents. Please give, per service: price (or "from"), duration, deliverables, and what's out of scope. Until then `/pricing` says "Priced on a call" with no figures.
3. **Install endpoints before launch.** The Tokvera and Sievant release steps require `tokvera.` and `sievant.halotrcer.com/install.{sh,ps1}` to be live and byte-identical to the scripts before tagging. Proposal: a separate `INSTALL_ENDPOINTS` flag serving scripts synced from a ref you name, while pages still say "Launching soon". Acceptable, or should the endpoints wait for `LAUNCHED=true`?
4. **Sample reports.** None is real. Options:
   - (a) use the committed golden demo reports (Sievant `pkg/report/testdata/golden/gateway.*`, bundle `internal/report/testdata/golden/sim-all.*`, Tokvera's documented demo result), all labelled "Simulated demo run" with their source path and regeneration command;
   - (b) also run `tokvera scan --demo --out <this repo>/samples/tokvera` with a binary you provide, writing only into this repo.

   Which? (b) needs your OK, because it runs a product binary.

5. **Sievant scoring page.** There is no Sievant score yet. Should I build `/scoring` as "How Sievant rates findings" (severities, deal-risk rules as the bundle uses them, `--fail-on`, the planned A–F score marked as roadmap), or omit it until the score exists?
6. **Sievant latency number.** README "0.25 ms p99" vs BASELINE.md ~322–348 µs. I'll show no figure until the Sievant session reconciles them. OK?
7. **Missing channels.** Tokvera has no air-gapped bundle (roadmap). The bundle has no scripts, Docker, Helm or air-gapped bundle yet. The picker hides absent channels. OK?
8. **Docs sync ref.** Which ref should the docs sync from: `main` of each repo, or a release tag once it exists? (Recommend: `main` until launch, tags after.)
9. **CSP hashes for JSON-LD.** Accept the global CSP (JSON-LD isn't executed, so it isn't subject to `script-src`), or require generated per-path hashes within the 100-rule `_headers` limit?
10. **Calculator framing vs "never estimate savings".** The products refuse to estimate savings. The calculator computes "uncached-repeat spend" from the user's own inputs, labelled as an estimate, and never says "save". OK, or drop that second output and show spend only?
11. **Booking target.** What is the Cal.com (or other) URL behind `/book`?
12. **Wordmark.** Text-only wordmark plus an SVG monogram favicon. OK, or do you have a logo?
13. **Service names.** Tokvera's repo calls it "the audit"; Sievant's repo has no review product. I'll use your names: "AI Performance & Observability Audit", "Agent Security Review", "AI Cost & Security Audit". Confirm.
14. **"One command" vs "two commands".** Tokvera's README says "two commands". On www I'll say "one check" (`halotrcer check`), and on Tokvera "two commands". OK?
15. **Analytics.** Cloudflare Web Analytics loads a beacon script from `static.cloudflareinsights.com`, the one third-party script. When you enable it, CSP gains that origin. Acceptable?
16. **About/legal.** Do you want a personal bio on `/about`? What legal entity name should go in the terms? (NOTICE says "Satyajit Rajaraman / Halotrcer".) The privacy and terms pages will be marked as drafts until you approve them.
17. **For other sessions (FYI, not mine to change).** Tokvera `schema/findings.v1.schema.json` uses an `$id` on `tokvera.dev`; Sievant's `www.halotrcer.com/book` 404 is blocking its release checklist.

---

## 16. Manual steps for you (by M1 merge)

1. Cloudflare: add the `halotrcer.com` zone (if not already) and create the three Pages projects from `rajasatyajit/halotrcer-site` with the build commands, output dirs and env vars from §1–2.
2. DNS: custom domains `www`, `tokvera` and `sievant` on the respective projects (Pages creates the CNAMEs). Apex: a proxied placeholder record plus a Redirect Rule `halotrcer.com/*` → `https://www.halotrcer.com/${1}` (301).
3. SSL/TLS: Full (strict), "Always Use HTTPS" on, minimum TLS 1.2, and zone HSTS off (the site sends its own). Submit to hstspreload.org only after every subdomain serves HTTPS.
4. Booking: create the Cal.com event and send me the URL for `BOOKING_URL`.
5. Search Console: add a Domain property for `halotrcer.com` (DNS TXT) and submit `https://www.halotrcer.com/sitemap-index.xml`.
6. Cloudflare Web Analytics: leave off until you decide (Q15).
