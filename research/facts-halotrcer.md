# Halotrcer fact sheet (for www.halotrcer.com)

Source: ~/workspace/halotrcer-installer (origin git@github.com:rajasatyajit/halotrcer.git), read-only, 2026-10-21.
Checked-out branch: `m2-channels` (local branches: main, m1-cli, m2-channels, fix-fmt-check; no tags). `packaging/` and `scripts/` are UNTRACKED (work in progress by another session). main HEAD: c19c0d9.
All paths are relative to the repo root. "NOT FOUND" means I searched and found nothing.

## 0. Caveats up front
- README.md is a single line: `# halotrcer-installer` (README.md:1). **There is no README positioning quote.** Positioning below comes from PLAN.md, CLAUDE.md, the CLI usage text, and NOTICE.
- No release exists. PLAN.md:20 (C1): "**Neither tool has a release.** Both repositories are private." and "Halotrcer cannot be released, and its smoke matrix cannot pass, until both `v0.2.0` releases exist." PLAN.md:273: "Both tools are unreleased and private (C1). Halotrcer's release is blocked on two other repositories' owner-gated releases."
- install.sh / install.ps1 DO NOT EXIST yet (planned for M3, PLAN.md:172-190). No .goreleaser.yaml, release.yml, Dockerfile, charts/ or docs/install.md exist (only .github/workflows/ci.yml).

## 1. Positioning
- PLAN.md:3: "Halotrcer installs and runs two separately released tools and merges their results into one report:"
  - PLAN.md:5: "**Tokvera**: LLM inference cost and latency scanner." (github.com/rajasatyajit/tokvera, PLAN.md:6)
  - PLAN.md:7: "**Sievant**: MCP security gateway." (github.com/rajasatyajit/sievant, PLAN.md:8)
- CLI tagline, cmd/halotrcer/main.go:25: "halotrcer: one cost and security check for AI products."
- cmd/halotrcer/main.go:1-4: "Command halotrcer installs Tokvera and Sievant and runs both against one AI product, merging their results into one report. It never contains either tool's code: it runs their released binaries and reads their documented JSON."
- NOTICE:4-5: "It installs and runs Tokvera and Sievant, which are separate products distributed under their own licenses; no code from either is included."
- check usage, cmd/halotrcer/check.go:22-28: "Runs Tokvera against the inference endpoint and Sievant against this machine's MCP client configuration, in parallel, and writes one combined report (HTML, PDF and JSON) into --out. Tokvera sends load to the target: halotrcer shows Tokvera's plan and asks first, or give --yes. Sievant only reads configuration files."
- Planned README content (M5), PLAN.md:219: "what Halotrcer is, a one-line install, a one-line check, links to both tools, the privacy statement and `/book`." PLAN.md:222: "No figures, customers or claims that the code and the two tools' outputs do not support."
- Tokvera domain seen in fixture output: `tokvera.halotrcer.com` (internal/report/testdata/golden/demo-no-cta.json:278, Tokvera's own privacy line, not Halotrcer's).

## 2. Commands

### Subcommands (cmd/halotrcer/main.go:27-33)
```
halotrcer check --target URL [flags]    run Tokvera and Sievant, write one report
halotrcer install [tokvera|sievant|all] install or upgrade the tools
halotrcer doctor [--json]               check this installation
halotrcer update                        replace halotrcer with a newer release
halotrcer uninstall [--all]             remove halotrcer (and what it installed)
halotrcer version                       print the version
```
- `version` prints `halotrcer <version> (commit <sha7>)` (main.go:58); falls back to "dev"/"unknown" (buildinfo.go:21,35).
- Exit codes: 0 ok, 1 failure, 2 usage (main.go:15-19; CLAUDE.md:69 "fixed once documented").

### `halotrcer check` (cmd/halotrcer/check.go:20-59, defaults at :72-94)
`usage: halotrcer check (--target URL | --demo) [flags]`
- target (Tokvera): `--target URL` (OpenAI-compatible or Anthropic), `--demo` (Tokvera's built-in simulator; "no endpoint, no keys"), `--kind openai_compatible|anthropic`, `--model`, `--api-key-env NAME` ("the NAME of the variable holding the API key (never the key)"), `--suite quick|standard|deep` (default quick), `--max-requests N`, `--max-cost USD`, `--request-timeout D` (Tokvera default 60s), `--pricing FILE` ("your rate sheet, passed to Tokvera unchanged"), `--allow-private-target`, `--yes`.
- agent security (Sievant): `--mcp-config PATH` (repeatable), `--no-project`, `--gateway-report` ("also include sievant report (gateway coverage and gaps)").
- report: `--out DIR` (default `halotrcer-report`), `--format` (default `html,pdf,json`), `--monthly-requests N`, `--no-cta`, `--skip-tokvera`, `--skip-sievant`, `--allow-partial`, `--timeout D` (default 5m).
- "Exit codes: 0 report written; 1 a tool or the report failed; 2 usage." (check.go:58)
- Without a terminal and without --yes: "halotrcer check: Tokvera sends load to the target; with no terminal to confirm, pass --yes" (internal/check/check.go:364). Interactive prompt: "Send this load to the target? [y/N] " after showing Tokvera's `--dry-run` plan (check.go:369-375). PLAN.md:61 (I2).
- Report files written as `<out>/report.html`, `report.pdf`, `report.json` (internal/report/write.go:75).

### Terminal output format (internal/check/check.go:407-442)
```
Efficiency grade (Tokvera): <grade>[ (Provisional scoring <scoring_version>)]
Cost per 1,000 requests: $<x> (measured; rates as of <date>)   | "Cost per 1,000 requests: not computed"
At <N> requests/month: $<x.xx> a month (spend, not a saving)   (only with --monthly-requests)
Reliability concern: <text>                                     (grade D/F)
Agent security (Sievant): <c> critical, <h> high, <m> medium; deal risk: <n>
Top findings:
  1. <title> (<source> <ref>)
Report: <path>
```
Grade `insufficient_evidence` prints "no grade (insufficient evidence)" (check.go:444-447). Output passes through the redactor (check.go:441).

### `halotrcer install` (cmd/halotrcer/install.go:22-37)
`usage: halotrcer install [tokvera|sievant|all] [flags]` — flags `--via brew|scoop|winget|go|apt|dnf|apk|direct`, `--version V`, `--dir DIR` (default ~/.local/bin), `--require-cosign`, `--dry-run`. Ends with "next: halotrcer check --target <inference-url>" (install.go:94). Per-tool output line: `<tool>: <action> via <channel> (<version>)` (system.go:142-146).

### `halotrcer update` (install.go:99-110): flags `--check`, `--version V`, `--require-cosign`, `--dry-run`. Messages: "halotrcer %s is the latest release" / "halotrcer %s is installed; %s is available (halotrcer update)" (install.go:150-152).

### `halotrcer uninstall` (install.go:165-174): `--all` ("also remove the tools halotrcer installed"), `--yes`, `--dry-run`. A tool installed another way is left alone (install.go:167-168).

### `halotrcer doctor [--json]` (install.go:281): "Checks this installation and runs both tools' doctor. Exit codes: 0 no failure; 1 a check failed; 2 usage." PLAN.md:122-125 lists checks: tools found, versions vs matrix, cosign present, writable output dir, state file, owning channel.
- NOTE: PLAN.md:77 and CLAUDE.md:67 mention `doctor --check-update`, but no `--check-update` flag exists in halotrcer's code (grep found none). Flag as planned/not implemented.

## 3. Combined report

### JSON schema (internal/report/model.go)
- `schema_version`: `"halotrcer.check-report/v1.0.0"` (model.go:16), "Fields are only ever added within v1." (model.go:15)
- Top-level (model.go:44-58): `schema_version, generator, generated_at, target, tools[], summary, cost_performance, agent_security, fix_plan[], ranking, privacy, cta`.
- `tools[]` (model.go:61-68): `name, version, status (ok|failed|skipped), error, compat_warning`.
- `summary` (model.go:71-81): `top[] (5 items), grade, grade_provisional, usd_per_1k_requests, spend, security_counts, deal_risk, reliability_concern, partial`.
- `cost_performance` (model.go:84-105): `target, model, simulated, simulated_timing, grade, points, grade_reason, scoring_version, provisional, provisional_note, caps, requests, succeeded, failed, duration_ms, levels[], cost, spend, findings[], privacy[]`. `levels[]` (108-117): concurrency, requests, failed, ttft_p50/p95/p99_ms, request_duration_p95_ms, output_tokens_per_s_p50. `cost` (120-130): usd_per_1k_requests, not_computed, estimate, basis, pricing_sheet, pricing_as_of, pricing_source, pricing_stale, pricing_warning.
- `agent_security` (133-140): `files[] (client, path, scope, servers, unwrapped, error), counts, tools_inspected, findings[], notes, gateway`. `gateway` (153-162): period, coverage, controls_enforced, controls_total, requests, blocked, gaps[] (severity,title,fix), disclaimer.
- `fix_plan[]` (172-186): `week, title, items[] (source, ref, title, fix, effort, where)`.
- `ranking` (189-193): `scoring_version, provisional, note`.
- `cta` (196-199): `text, url`.
- Finding item (internal/scoring/scoring.go Item): `source (tokvera|sievant), ref, title, dimension, tier, weight, deal_risk, why, week` + carried source fields `status, impact, rank, effort, preview, severity, evidence, why_it_matters, fix, detail, client, file, server, where`. `spend`: `usd_per_1k_requests, monthly_requests, monthly_usd, pricing_as_of, pricing_source, estimate`.
- HTML sections (internal/report/html.go:86-162): "Halotrcer report", "Executive summary", "Cost & performance", "Agent security", "30-day fix plan", "How to read this report". HTML is self-contained, CSP `default-src 'none'; style-src 'unsafe-inline'`, no scripts, light/dark (PLAN.md:95). PDF via own pure-Go writer (PLAN.md:25, 96).
- Input compatibility (internal/compat/matrix.json:4-13): Tokvera `>=0.2.0 <0.3.0`, schema prefix `tokvera.scan-report/v1.`; Sievant `>=0.2.0 <0.3.0`, `report_version` 1. Outside range: warn and continue; unknown schema major: refuse (PLAN.md:36).

### Scoring / provisional (docs/scoring.md, verbatim)
- docs/scoring.md:3-5: "> **Provisional.** Halotrcer's ranking model is at version 0.1.0 (`scoring_version` in the combined JSON). Its tiers are judgement, not calibrated against real results, and may change before 1.0.0."
- docs/scoring.md:9-14: "The model only **orders** what the two tools measured: - It computes no new measurement. - It assigns no dollar value to a finding. - It never estimates savings."
- docs/scoring.md:14: "Each tool's own grading is left exactly as it reported it: Tokvera's Efficiency Score and its provisional label, and Sievant's severities."
- Dimension (docs/scoring.md:29-35): Tokvera pillar `cost_and_cache` → cost; `latency`, `capacity`, `reliability` → latency; `observability` (or other) → operational; every Sievant finding → security.
- Weight (docs/scoring.md:40-41): "**Tokvera:** `impact` divided by the largest `impact` in the report. A `warn` counts half as much as a `fail` with the same impact." "**Sievant:** critical 1.0, high 0.75, medium 0.5, low 0.25, info 0."
- Deal risk (docs/scoring.md:45-54): "Deal risk is a tag, not a score." Rules: SEC001–SEC004 (credential, secret value, URL password or capability URL in config), AUTH001 (remote server with no credential), NET001 (remote server over plain HTTP), PERM001/PERM002 (filesystem root or whole home dir given to a server). "Tokvera findings never do."
- Reliability concern (docs/scoring.md:58): "When Tokvera grades the endpoint **D** or **F**, the report shows a *reliability concern* beside the grade and in the summary. It is not deal risk and does not move any item."
- Tiers (docs/scoring.md:64-70):
  1. Sievant critical findings; deal-risk findings at high severity
  2. Tokvera `fail` on cost or latency with `impact` at or above the median impact of the report's Tokvera findings
  3. the remaining Sievant high findings
  4. the remaining Tokvera `fail` findings
  5. everything else: warnings, medium and lower security findings, and Tokvera preview checks
- Ties (docs/scoring.md:72-75): Tokvera before Sievant; Tokvera by `rank`; Sievant by rule, file, server, field.
- 30-day plan (docs/scoring.md:81-88): week 1 = tier 1 + any Tokvera fix with effort upper bound under one day; week 2 = tier 2; week 3 = tier 3; week 4 = the rest. "The fix text is the tool's own... Halotrcer writes no remediation advice of its own."
- Money (docs/scoring.md:92-97): "A dollar figure appears in exactly one case: Tokvera computed `cost.usd_per_1k_requests`, and you passed `--monthly-requests N`." ... "There is no savings figure anywhere, because neither tool measures what a fix would save."
- **There are no grade letter thresholds in Halotrcer's docs.** Grades (A–F, `insufficient_evidence`) are Tokvera's own; their thresholds live in Tokvera's docs/scoring.md, not this repo.
- Tokvera provisional label, verbatim (internal/report/model.go:29-30, from tokvera docs/scoring.md:94): label "Provisional scoring"; note "The weights and thresholds are provisional: they have not yet been calibrated against real pilot scans and may change before scoring 1.0.0."
- Halotrcer ranking note (model.go:34-35): "Halotrcer's ranking across the two tools is provisional (scoring version 0.1.0): its tiers are judgement, not calibrated. See docs/scoring.md." `scoring.Version = "0.1.0"` (internal/scoring/scoring.go:19).

## 4. Install

### Status per channel
| Channel | Exact command / location | Source | Status |
|---|---|---|---|
| Script (sh) | `scripts/install.sh`, to be served at `https://www.halotrcer.com/install.sh` | PLAN.md:174 | NOT WRITTEN (M3) |
| Script (PowerShell) | `scripts/install.ps1`, served at `https://www.halotrcer.com/install.ps1` | PLAN.md:174 | NOT WRITTEN (M3) |
| Homebrew cask | `brew install --cask rajasatyajit/tap/halotrcer` (pattern `rajasatyajit/tap/<name>`) | internal/install/channels.go:88; PLAN.md:52 | No cask published; tap "holds only a README" (PLAN.md:20) |
| Scoop | `scoop install rajasatyajit/halotrcer`; bucket `https://github.com/rajasatyajit/scoop-bucket` | channels.go:80-81,90; PLAN.md:52 | Not published |
| winget | `winget install -e --id Halotrcer.Halotrcer` | channels.go:30,92; PLAN.md:51 | Not published |
| go install | `go install github.com/rajasatyajit/halotrcer/cmd/halotrcer@latest` | PLAN.md:50; channels.go:55-57,98 | Repo is private (PLAN.md:20) |
| apt | `sudo install -d -m 0755 /etc/apt/keyrings` / `sudo curl -fsSLo /etc/apt/keyrings/halotrcer-packages.asc https://rajasatyajit.github.io/packages/halotrcer-packages.asc` / `echo "deb [signed-by=/etc/apt/keyrings/halotrcer-packages.asc] https://rajasatyajit.github.io/packages/apt stable main" \| sudo tee /etc/apt/sources.list.d/halotrcer.list` / `sudo apt update && sudo apt install halotrcer` | channels.go:131-154 | `rajasatyajit/packages` has no gh-pages branch (PLAN.md:20) |
| dnf | `sudo curl -fsSLo /etc/yum.repos.d/halotrcer.repo https://rajasatyajit.github.io/packages/rpm/halotrcer.repo` / `sudo dnf install halotrcer` | channels.go:159-161; PLAN.md:46 | Not published |
| apk | `wget -O /etc/apk/keys/satyajit.rajaraman@halotrcer.com-halotrcer.rsa.pub https://raw.githubusercontent.com/rajasatyajit/halotrcer/main/packaging/keys/satyajit.rajaraman@halotrcer.com-halotrcer.rsa.pub` / `wget https://github.com/rajasatyajit/halotrcer/releases/download/<tag>/halotrcer_<ver>_<arch>.apk` / `apk add ./halotrcer_<ver>_<arch>.apk` ("no apk repository exists: the signed package comes from the release") | channels.go:140-142,163-171 | Not published; key file is untracked |
| Docker image | `ghcr.io/rajasatyajit/halotrcer` (distroless static-debian13:nonroot, holds halotrcer + tokvera + sievant) | PLAN.md:53,158-159 | Planned M2 |
| Helm | `oci://ghcr.io/rajasatyajit/charts/halotrcer` (umbrella; `tokvera.enabled`/`sievant.enabled` default false) | PLAN.md:47,53,160 | Planned M2 |
| GitHub Releases | `https://github.com/rajasatyajit/halotrcer/releases/download/<tag>/<file>`; archive `halotrcer_<version without v>_<os>_<arch>.tar.gz` (.zip on Windows), `checksums.txt`, `checksums.txt.sigstore.json` | internal/install/direct.go:26-33,164-170; PLAN.md:137-138 | None exists |
| Direct (no root) | `halotrcer install` downloads to `~/.local/bin` (Windows `%LOCALAPPDATA%\Programs\<tool>`) | install/detect.go:132-137; PLAN.md:44 | Implemented in CLI |
| Air-gapped | NOT FOUND. Only mirror env vars `HALOTRCER_INSTALL_DOWNLOAD_BASE`, `HALOTRCER_INSTALL_API_BASE` (https or loopback http) | direct.go:26-31; PLAN.md:63,177 | — |

- Halotrcer never runs sudo: for apt/dnf/apk "it prints the exact commands, repository setup included, and stops." (PLAN.md:41-44; CLAUDE.md:70).
- Planned install.sh flags (PLAN.md:175-179): default installs Halotrcer, Tokvera and Sievant; `--only tokvera|sievant`; `--version`, `--dir`, `--global`, `--dry-run`, `--no-verify`, `--require-cosign`, `-h`; "At the end it prints `halotrcer check --target <url>`."
- Release candidates never go to Homebrew, Scoop, winget or package repos (CLAUDE.md:92; PLAN.md:161).
- State file: `~/.local/state/halotrcer/installed.json` (Windows `%LOCALAPPDATA%\halotrcer\installed.json`) (install/state.go:28-39).

### Verification (verbatim)
- Order (install.go:25-28): "downloads the release and verifies it: the cosign signature on checksums.txt when cosign is installed, then the archive's SHA-256."
- cosign invocation (direct.go:214-216): `cosign verify-blob --bundle checksums.txt.sigstore.json --certificate-identity-regexp '^https://github\.com/rajasatyajit/halotrcer/\.github/workflows/release\.yml@refs/tags/v' --certificate-oidc-issuer https://token.actions.githubusercontent.com checksums.txt` (identity regexp: channels.go:50-52; issuer: channels.go:45).
- Without cosign: "not checked: cosign is not installed (the SHA-256 is still checked)" (direct.go:200). Mismatch: "SHA-256 does not match checksums.txt; refusing to install" (direct.go:232). Success line: "<tool>: signature <...>; SHA-256 matches checksums.txt" (install.go:219).
- Planned: syft SBOM, SLSA provenance via `actions/attest`, `gh attestation verify` (PLAN.md:137-139,166,286).

### packaging/ (untracked)
- `packaging/bundled-tools.env`: pinned Tokvera/Sievant versions and image/chart digests — all EMPTY "until both tools publish v0.2.0" (bundled-tools.env:9,14-19).
- `packaging/repo-meta.env`: `REPO_ORIGIN=Halotrcer`, `REPO_LABEL=Halotrcer`, `REPO_DESCRIPTION=Halotrcer packages (Tokvera, Sievant), signed by Halotrcer Packages`, `REPO_ARCHITECTURES=amd64 arm64` (repo-meta.env:7-10).
- `packaging/keys/README.md:9-10`: apk key `satyajit.rajaraman@halotrcer.com-halotrcer.rsa.pub` (RSA-4096; DER sha256 `8fd0bd739a0b08e5a1b38016ff2b709f9312a0399bf60b465d4ee16841de15c4`); deb/rpm key `halotrcer-packages.asc`, `Halotrcer Packages <satyajit.rajaraman@halotrcer.com>`, RSA-4096, fingerprint `D2D9 6618 831A C55B 81E2  4DA3 039B 5DA0 D3E3 9071`.
- scripts/release/ (untracked): bundled-tools.sh, compare-archives.sh, image-subject.sh, package-repos.sh, package-repos-docker.sh, preflight.sh, publish-repos.sh, push-chart.sh, write-keys.sh.

## 5. Sample combined report
- No sample under testdata/ itself; committed golden outputs are in `internal/report/testdata/golden/`: `sim-all`, `flaky-smoke-gateway`, `demo-no-cta`, each as .json/.html/.pdf.
- How generated (internal/report/report_test.go:99-122; regenerate with `go test ./internal/report -update`, CLAUDE.md:20): built by `report.Build` from fixtures —
  - sim-all = tokvera `sim.report.json` + sievant `scan-all.json`
  - flaky-smoke-gateway = `flaky.report.json` + `scan-smoke.json` + gateway `report.json`
  - demo-no-cta = `demo.report.json` + `scan-smoke.json`, `--no-cta`
  - test inputs use `MonthlyRequests: 2_000_000` (report_test.go:73), generator "halotrcer test", fixed time 2026-10-20T12:00:00Z (sim-all.json:3-4).
- Fixtures (testdata/fixtures/README.md): real outputs of unreleased builds Tokvera b97e278 (`tokvera v0.1.0-dev`) and Sievant d8a8bcf (`sievant v0.1.0-157-gd8a8bcf`) (README.md:13-16); Sievant run "against Sievant's own synthetic configurations ... (every token in them is fake)" (:38-40); `fixture-pricing.yaml` = "**invented rates** ... Not any provider's prices." (:30). Both versions are outside the matrix, so goldens carry a compat warning (sim-all.json:11).
- sim-all summary values (sim-all.json:117-135): grade "A", grade_provisional true, usd_per_1k_requests 0.0475, spend monthly_requests 2000000 → monthly_usd 95, pricing_source "halotrcer fixture (synthetic rate, not a real price)", security_counts critical 4 / high 8 / medium 7 / low 0 / info 1, deal_risk 12. Tokvera scoring_version "0.9.0" (sim-all.json:144).
- **Do not present these numbers as real results**: synthetic rates, simulator target, fake tokens.

## 6. Paid "AI Cost & Security Audit"
- Only references: CTA text "AI Cost & Security Audit" and URL `https://www.halotrcer.com/book` (internal/report/model.go:20-21; PLAN.md:102), omitted with `--no-cta`. Both tools are run with their own `--no-cta` "so there is one CTA" (PLAN.md:103).
- Scope, price, deliverables, duration: NOT FOUND anywhere in the repo.

## 7. Privacy claims (verbatim)
- Report privacy statement (internal/report/model.go:38-41; emitted in every report, e.g. sim-all.json:830): "Halotrcer contacts only the target you give it (through Tokvera) and reads only the MCP configuration files Sievant reads, on this machine. It sends no telemetry. Secrets stay masked as each tool masks them; on top of that, Halotrcer drops URL credentials and query strings, hides environment values, shows your home directory as ~ and replaces your user name with <user>."
- CLAUDE.md:64-67: "No telemetry. Network access is limited to: the scanned target; release downloads during `install` and `update`; `doctor --check-update`." (same in PLAN.md:77).
- The phrase "nothing leaves your machine" does NOT appear. Note: it would be inaccurate, since Tokvera sends load to the user's target and install/update download releases.
- Redaction (PLAN.md:261-269; CLAUDE.md:74-80): URLs keep scheme/host/path only; env values never printed; home → `~`; username → `<user>`; canary tests on every output.

## 8. Release status, version, license, roadmap
- Version: no tag; binary prints "dev" unless stamped (buildinfo.go:14-22). Go module `github.com/rajasatyajit/halotrcer`, go 1.27.0 / toolchain go1.27.2 (go.mod:1-5).
- License: Apache-2.0 (LICENSE; NOTICE:3). Copyright: "Halotrcer, Copyright 2026 Satyajit Rajaraman / Halotrcer" (NOTICE:1).
- Milestones (PLAN.md:68-222): M1 CLI (merged to main, commit 468de53), M2 bundle channels (branch m2-channels, in progress), M3 installer scripts, M4 smoke matrix, M5 docs (README, SECURITY.md, docs/install.md, check.md, report-anatomy.md, scoring.md, compatibility.md, faq.md, roadmap.md). PLAN.md:12: "Status: decisions taken (§1); M1 in progress on `m1-cli`." (stale relative to git).
- Dependency gate: Tokvera and Sievant both plan `v0.2.0-rc.1` then `v0.2.0` (PLAN.md:20).
- Site-relevant endpoints: `https://www.halotrcer.com/install.sh`, `/install.ps1` (PLAN.md:174); `https://www.halotrcer.com/book` (model.go:21).
- Release data a site could consume at build time: no dedicated manifest. Candidates: GitHub releases API `https://api.github.com/repos/rajasatyajit/halotrcer/releases/latest` (direct.go:28-33, used by `update --check`); release `checksums.txt`; the embedded compatibility matrix `internal/compat/matrix.json` (`matrix_version: 1`); `packaging/bundled-tools.env` (KEY=value, empty). PLAN.md:176 says tool versions "come from the release's embedded matrix file".
- Planned SECURITY.md: "5-business-day acknowledgement aim and GitHub private reporting" (PLAN.md:220).

## 9. Numbers and claims, flagged
| Claim | Source | Flag |
|---|---|---|
| Combined report "in under 5 minutes" | PLAN.md:283 (acceptance criterion); `--timeout` default 5m (check.go:94) | Target, not proven (proved "M1 (local), M4") |
| "One command on a fresh machine installs all three" | PLAN.md:282 | Planned; needs M4 + tools' v0.2.0 |
| Scoring version 0.1.0, provisional | docs/scoring.md:3; scoring.go:19 | OK to state |
| Severity weights 1.0/0.75/0.5/0.25/0 | docs/scoring.md:41 | OK |
| $0.0475 / 1k req, $95/mo, 2,000,000 req, grade A, 4 critical/8 high/12 deal risk | golden sim-all.json | SYNTHETIC — invented rates, simulator, fake tokens |
| "No telemetry" | model.go:39; CLAUDE.md:64 | Supported by design rules |
| Platforms amd64 arm64 (packages) | repo-meta.env:10 | Repo metadata only |
| Smoke distros ubuntu-24.04, debian-13, fedora-43, amazonlinux-2023, alpine-3.22; Windows/macOS arm+intel | PLAN.md:196-205 | Planned M4, not run |
| No savings figure anywhere | docs/scoring.md:97; PLAN.md:40 | Site must not claim savings |
