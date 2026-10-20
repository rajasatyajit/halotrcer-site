# Tokvera: sourced fact sheet for the website

Repo: ~/workspace/tokvera (HEAD 0f37696). All paths are relative to the repo. Read-only survey, 2026-10-21.
Quotes are verbatim. Where a fact is missing, this sheet says so.

## 1. Positioning and problem statement

- Headline (README.md:3-4): "**Find out where your LLM inference is slow, failing or expensive, in two commands.**"
- README.md:6-10: "`tokvera scan` measures an inference endpoint the way your users feel it:" then bullets "time to first token, and latency percentiles at rising concurrency;" / "error rates;" / "cost per 1,000 requests;" / "whether repeated prompts are worth caching."
- README.md:12-15: "It grades the endpoint A–F and writes a self-contained report. It works with OpenAI-compatible servers (vLLM, TGI, Ollama, llama.cpp and others) and the OpenAI and Anthropic APIs. It is free and Apache-2.0, a single static binary, with no telemetry."
- CLI tagline (cmd/tokvera/main.go:25): "tokvera - end-to-end automated AI performance & observability audit"
- Man page (cmd/tokvera/man.go:87): "One binary: a free scan that grades an inference endpoint A-F (tokvera scan), ..."
- Decision: "The README leads with the free scan, not the audit." (DECISIONS.md:83)
- Audit report title, as generated: "Tokvera AI performance & observability audit — <client>" (out/demo/report.md:1)

## 2. What it measures, targets, inputs

Scan metrics (docs/scoring.md:49-76, docs/scan.md):
- TTFT, measured from the moment the request was written to the first non-empty content chunk; p95/p99 are "exact nearest-rank percentiles ... never interpolated" (scoring.md:49-52).
- TTFT load ratio (p99 at highest concurrency / p99 at concurrency 1) (scoring.md:52-54).
- Inter-chunk gap p95, an upper bound on per-token latency (scoring.md:54-56).
- Error rate overall and at peak (scoring.md:57-58).
- Generation-rate load ratio: tokens/s if usage was reported, otherwise chunks/s, and the report says which (scoring.md:59-63).
- Observability: share of streams that reported usage, Prometheus `/metrics` present (scoring.md:64-66).
- Cache potential: exact repeats in a user-supplied `--prompts` sample, "read locally and never sent" (scoring.md:67-71).
- Cost per 1,000 requests, "reported as a measurement, not graded" (scoring.md:71-73).
- GPU utilization (nvidia-smi for a loopback target, or `--dcgm-url`), preview only, not counted (scoring.md:74-76).
- Latency table per level: TTFT, request duration, output rate, p50/p95/p99 (docs/report-anatomy.md:189).

Targets (docs/scan.md:14-36):
- OpenAI-compatible servers: "vLLM, TGI, Ollama, llama.cpp's server and others" (scan.md:14-15). Reads `/v1/models`. Detects the server family as a suggestion (scan.md:18-20).
- OpenAI and Anthropic APIs (scan.md:21). Keys come from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` or `--api-key-env`. "The key itself is never a flag and never appears in output." (scan.md:23-25). Anthropic needs `--model` (scan.md:26).
- The embedded rate sheet "covers the OpenAI and Anthropic hosted APIs only"; for anything else use `--pricing FILE` (docs/faq.md:46-49).
- Suites (scan.md:43-47): quick = levels 1,2,4, 24 requests; standard (default) = 1,2,4,8,16, 100 requests; deep = 1,2,4,8,16,32, 300 requests. Each request is at most 256 completion tokens (scan.md:40-41).

Audit inputs (docs/audit.md:160-163): OTLP JSON traces (Collector file-exporter output) or Tokvera usage-log lines (docs/usage-log-format.md, v1 JSONL), optionally a live benchmark (audit.md:217-220).
`tokvera capture` (docs/capture.md:1-10): a reverse proxy for OpenAI-compatible chat completions that writes usage-log lines. "The Anthropic Messages API is not supported." (capture.md:10). Default listen 127.0.0.1:8787 (capture.md:59).

Integrations:
- GitHub Action `rajasatyajit/tokvera-scan-action` (action/README.md:14). It fails a job on a scan error, a grade below `fail-under`, or a regression (action/README.md:5-6).
- Helm chart `oci://ghcr.io/rajasatyajit/charts/tokvera` (docs/helm.md:9).
- MCP server `tokvera mcp`. Tools: scan_demo, scan_plan, scan, summarize_report, verify_report, list_suites, doctor (docs/agents.md:20-28).
- Claude Code / Codex plugin (docs/agents.md:49-58, README.md:72-74).
- Observability stack (Collector, Prometheus, Grafana) via `tokvera stack up` (docs/audit-kit.md:50-79).
- Caching proxy `tokvera cache` / `tokvera-cache` (docs/audit-kit.md:114-168).
- OTel GenAI instrumentation for go/python/node via `tokvera instrument` (docs/audit-kit.md:6-26).

## 3. Commands and flags

Full command list (cmd/tokvera/main.go:25-58): scan, list suites, audit, bench, capture, sim, demo, findings, playbooks, instrument, stack, cache, init, doctor, update, uninstall, completion, man, report sign|verify, mcp, install-skill, config, version. Global flags: --quiet, --verbose, --json.

Scan help (cmd/tokvera/scan.go:27-69): --target, --kind, --model, --api-key-env, --allow-private-target, --suite, --max-requests, --max-cost, --rate, --request-timeout (default 60s), --yes, --dry-run, --pricing, --prompts, --no-metrics, --dcgm-url, --no-gpu, --out (default tokvera-scan), --no-cta, --fail-under. Exit codes: 0 report written, 1 runtime error or declined, 2 usage, 4 grade below --fail-under (scan.go:68-69; docs/scan.md:125-129).

The free-scan commands, exact (README.md:19-21, 39-41):
```
curl -fsSL https://tokvera.halotrcer.com/install.sh | sh
tokvera scan --demo
tokvera scan --target http://localhost:8000/v1 --dry-run
tokvera scan --target http://localhost:8000/v1
```
The "next command" printed by `tokvera init` (cmd/tokvera/init.go:171): "Next: tokvera scan --demo (no endpoint needed), then tokvera scan --target URL; tokvera doctor checks the rest."
After install: "`tokvera doctor` checks the installation." (README.md:63)
CI regression (docs/scan.md:107-108): `tokvera scan --target "$ENDPOINT" --suite quick --yes --out new` then `tokvera scan summary --report new/report.json --baseline baseline/report.json`. Fails when a p95 grew >20% and ≥50 ms, or cost >10% (scan.md:114-116).
Audit: `tokvera audit --config audit.yaml` (docs/audit.md:193). Demo bundle: `./bin/tokvera demo --dir out` (audit.md:226).

Demo terminal output (README.md:24-35). Note: the code also prints a `Data:` line after `Report:` (cmd/tokvera/scan.go:505), and the CTA line "Want this fixed? https://www.halotrcer.com/book" (scan.go:506-507; pkg/scan/run.go:197). The README sample leaves both out.

## 4. Install channels (docs/install.md)

- Table (install.md:9-15):
  - Linux/macOS: `curl -fsSL https://tokvera.halotrcer.com/install.sh | sh`
  - Windows: `irm https://tokvera.halotrcer.com/install.ps1 | iex`
  - brew: `brew install --cask rajasatyajit/tap/tokvera`
  - scoop: `scoop install rajasatyajit/tokvera`
  - winget: `winget install -e --id Halotrcer.Tokvera`
  - go: `go install github.com/rajasatyajit/tokvera/cmd/tokvera@latest` (Go 1.26+)
  - docker: `docker run --rm ghcr.io/rajasatyajit/tokvera:latest version`
- Script locations: `scripts/install.sh` and `scripts/install.ps1`; "`tokvera.halotrcer.com` serves the same files" (install.md:17-18). Read-first variant: `curl -fsSLO https://raw.githubusercontent.com/rajasatyajit/tokvera/main/scripts/install.sh` then `less install.sh && sh install.sh` (install.md:22-23).
- Hosting status: "The domain `tokvera.halotrcer.com` is expected to serve these two files; that hosting is the owner's and is not configured here." (DECISIONS.md:2155-2156). Release checklist step 6: `curl -fsSL https://tokvera.halotrcer.com/install.sh | cmp - scripts/install.sh` (and the same for install.ps1) (docs/releasing.md:84-92). SPEC: "Domain `tokvera.halotrcer.com` (serves `/install.sh`, `/install.ps1`)." (SPEC.md:406)
- Script steps: detect platform, resolve the latest published release, idempotent, download the archive and checksums.txt, verify (cosign if present, then SHA-256), atomic install, PATH hint. They never edit PATH (install.md:28-44). They contact only api.github.com and github.com (install.md:46-48).
- install.sh options: --version, --dir (default `$HOME/.local/bin`), --global, --dry-run, --no-verify, --require-cosign (install.md:55-62). Piped: `curl -fsSL https://tokvera.halotrcer.com/install.sh | sh -s -- --version v0.2.0 --require-cosign` (install.md:67).
- install.ps1 params: -Version, -Dir (default `$env:LOCALAPPDATA\Programs\tokvera`), -Global, -DryRun, -NoVerify, -RequireCosign (install.md:77-84). With params: `& ([scriptblock]::Create((irm https://tokvera.halotrcer.com/install.ps1))) -Version v0.2.0 -RequireCosign` (install.md:89).
- Mirrors: `TOKVERA_INSTALL_DOWNLOAD_BASE`, `TOKVERA_INSTALL_API_BASE` (install.md:106-113).
- Homebrew: "**The macOS binary is not notarized by Apple.**" (install.md:121). Cosign check (install.md:129-135), verbatim:
```
TAG=v0.2.0   # the version you installed: tokvera version
curl -fsSLO "https://github.com/rajasatyajit/tokvera/releases/download/$TAG/checksums.txt"
curl -fsSLO "https://github.com/rajasatyajit/tokvera/releases/download/$TAG/checksums.txt.sigstore.json"
cosign verify-blob --bundle checksums.txt.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/rajasatyajit/tokvera/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  checksums.txt
```
  "`Verified OK` means ...", then `shasum -a 256 tokvera_*_darwin_*.tar.gz` against checksums.txt (install.md:138-140).
- Scoop: `scoop bucket add rajasatyajit https://github.com/rajasatyajit/scoop-bucket` then `scoop install rajasatyajit/tokvera`. winget lags because Microsoft reviews the PR (install.md:148-155).
- deb/rpm: `sudo apt install ./tokvera_0.2.0_amd64.deb`, `sudo dnf install ./tokvera-0.2.0-1.x86_64.rpm` (install.md:165-167).
- apk (install.md:175-177):
  `wget -O /etc/apk/keys/satyajit.rajaraman@halotrcer.com-tokvera.rsa.pub https://raw.githubusercontent.com/rajasatyajit/tokvera/main/packaging/keys/satyajit.rajaraman@halotrcer.com-tokvera.rsa.pub` then `apk add ./tokvera_0.2.0_x86_64.apk`.
- apt repo (install.md:193-198); key fingerprint `D2D9 6618 831A C55B 81E2  4DA3 039B 5DA0 D3E3 9071` (install.md:187):
```
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSLo /etc/apt/keyrings/halotrcer-packages.asc \
  https://rajasatyajit.github.io/packages/halotrcer-packages.asc
echo "deb [signed-by=/etc/apt/keyrings/halotrcer-packages.asc] https://rajasatyajit.github.io/packages/apt stable main" |
  sudo tee /etc/apt/sources.list.d/tokvera.list
sudo apt update && sudo apt install tokvera
```
- dnf/yum (install.md:205-206): `sudo curl -fsSLo /etc/yum.repos.d/tokvera.repo https://rajasatyajit.github.io/packages/rpm/tokvera.repo` then `sudo dnf install tokvera`.
- Container: distroless, non-root uid 65532, amd64/arm64 (install.md:214-215). Verify (install.md:219-221): `cosign verify ghcr.io/rajasatyajit/tokvera:v0.2.0 --certificate-identity-regexp '^https://github\.com/rajasatyajit/tokvera/\.github/workflows/release\.yml@refs/tags/v' --certificate-oidc-issuer https://token.actions.githubusercontent.com`
- Helm: `oci://ghcr.io/rajasatyajit/charts/tokvera` (install.md:234). Install command in docs/helm.md:9-13 (`helm install scan oci://ghcr.io/rajasatyajit/charts/tokvera --version 0.2.0 --namespace inference --set scan.confirm=true --set scan.target=... --set scan.model=my-model`).
- SLSA (install.md:246-249): `gh attestation verify tokvera_0.2.0_linux_amd64.tar.gz --repo rajasatyajit/tokvera --signer-workflow rajasatyajit/tokvera/.github/workflows/release.yml` (also for `oci://ghcr.io/rajasatyajit/tokvera:v0.2.0`).
- Air-gapped: there is no bundle yet. install.md:252-254 says to add `--bundle tokvera_0.2.0_provenance.sigstore.json`. The bundle plus an offline `tokvera verify` is on the roadmap (docs/roadmap.md:30-33).
- GitHub releases: every channel installs a published release of rajasatyajit/tokvera (install.md:3-7). There is no separate "download from Releases" section.
- tokvera-cache is a separate binary (install.md:226-230).
- Uninstall (install.md:258-262).
- Missing channels: no npm/pip/nix/snap/flatpak/AUR/chocolatey. The air-gapped bundle is not built. Version numbers in the examples (v0.2.0) are placeholders for a release that does not exist yet (see §10).

## 5. Reports

- Scan report: `report.html` and `report.json` in `--out` (report-anatomy.md:178). The HTML is self-contained, under 300 KB, no external requests (report-anatomy.md:182-183). HTML sections table (report-anatomy.md:185-194). SIMULATED banner for the demo (report-anatomy.md:196-197).
- `report.json` schema_version: `tokvera.scan-report/v1.3.0` (pkg/scan/report.go:14). It "only ever gains fields" (report-anatomy.md:201-202). Top-level fields (report-anatomy.md:204-216): schema_version, tool, generated_at, target, model, simulated, simulated_timing, score, scoring_version, findings[], checks[], levels[], run, plan, cost, pricing, discovery, metrics, gpu, cache, privacy, cta.
- No JSON Schema file exists for the scan report. `schema/` holds only `findings.v1.schema.json`, the audit findings schema (report-anatomy.md:234). Its `$id` is "https://tokvera.dev/schema/findings.v1.schema.json" (schema/findings.v1.schema.json:3). tokvera.dev appears nowhere else as a project domain. Flag it.
- Audit bundle layout (report-anatomy.md:232-241). Client report sections 1-7 (report-anatomy.md:245-253).
- Signing: `tokvera report sign --report tokvera-scan --key cosign.key` / `verify` (docs/report-signing.md:7-11). It writes attestation.json and attestation.sigstore.json, plus a SHA-256 of every file, the environment, and the hashed host name (report-signing.md:15-28). `--key` (local, optional `--tlog`) or `--keyless` (public Sigstore log). "No default" (report-signing.md:32-39).
- Sample reports:
  - No committed scan report.json or report.html. `out/` is gitignored (.gitignore:2).
  - Local, untracked audit bundles: `out/demo/` (report.md, report.html, findings.json, fixpack/, run-manifest.json, DELIVERY-CHECKLIST.md). Generated 2026-10-08 by v0.1.0-dev from simulated data (out/demo/report.md:3). `out/dogfood-smoke-2026-10/` is from a dev "smoke test (dogfood)" run (its report.md:3).
  - Committed goldens: `cmd/tokvera/testdata/golden/demo-report.md` and `demo-summary-scorecard.md`, from `tokvera demo`.
  - Committed: `testdata/demo/README.md` documents the deterministic `scan --demo` result: grade D, 60.8 points, 55/60 succeed, 776 ms run (testdata/demo/README.md:29-32). Defects are planted on purpose (lines 13-18).
  - The best real sample is to run `tokvera scan --demo --out <dir>`. It is deterministic and pinned by `TestDemoIsDeterministic` (testdata/demo/README.md:34). For an audit sample, run `tokvera demo --dir out` (docs/audit.md:226). Both carry a simulated banner.
  - brag-output/ (brag.mp4, brag.jpg, composition/index.html) is a marketing video, not a report.

## 6. Scoring (docs/scoring.md)

- Blockquote (scoring.md:3-7): "**Provisional scoring.** Scoring is at version 0.9.0. The weights and thresholds below have not yet been calibrated against real pilot scans, and they may change before 1.0.0. Every report says so beside its grade (`score.provisional: true` in `report.json`). The version will be promoted to 1.0.0 only after calibration against at least two real pilot scans."
- Generated label (scoring.md:94): "**Provisional scoring.** The weights and thresholds are provisional: they have not yet been calibrated against real pilot scans and may change before scoring 1.0.0."
- Terminal form: "Efficiency Score: D (60.8 / 100, provisional scoring 0.9.0)" (README.md:25).
- Thresholds are "**judgement**, not measurement" (scoring.md:15).
- Scoring per check: pass 100, warn 50, fail 0 (scoring.md:26).
- Weights: latency 35, reliability 30, capacity 15, observability 10, cost_and_cache 10 (scoring.md:98-104).
- Bands: A ≥90, B ≥80, C ≥70, D ≥60, F ≥0 (scoring.md:123-129).
- Check thresholds table (scoring.md:108-119). Example: TTFT p95 at c=1 passes at ≤800 ms, warns at ≤2000.
- Caps (scoring.md:133-139): no successful request → F; >25% errors → F; >5% errors → D; TTFT fails at c=1 → C; TTFT collapses under load → C.
- No letter grade when reliability has no graded check, or when fewer than 2 pillars were graded (scoring.md:38-41). `--fail-under` exits 4 (scoring.md:43-45).

## 7. Paid audit

- README.md:83-90: "The scan shows where the problems are. Fixing them, and auditing what your production traffic actually does, is the paid audit from Halotrcer." "**What it delivers:** a client report with findings and a prioritized plan, plus a fix pack of instrumentation, dashboards, alerts, a cache and loop guards." "**Book a call:** https://www.halotrcer.com/book"
- docs/audit.md:143-150: the bundle holds "a report; findings with their evidence; a prioritized plan; a fix pack of tested artifacts; notes for the consultant who reviews it."
- Scan vs audit (docs/faq.md:71-75).
- Workflow "The 5-minute first client audit" (audit.md:155-215). Step 1 says "Export the client's data (10 min, on the client's machine)." (audit.md:160).
- Fix-pack playbooks shipped: PB-DASHBOARDS-ALERTS, PB-MAXTOKENS-TUNE, PB-SEMANTIC-CACHE, PB-TTFT-CAPACITY, PB-LOOP-GUARD, PB-OTEL-GENAI (playbooks/).
- Consultant extras: branded "Prepared by Halotrcer" client page (audit-kit.md:28-48), premium audit kits signed with Ed25519 (docs/kit.md).
- PRICES: none. No price, fee, tier or duration appears in README, docs/audit.md, audit-kit.md, kit.md, SPEC.md or PLAN.md. The exact name "AI Performance & Observability Audit" does not appear as a product name. The closest strings are the CLI tagline (main.go:25) and the report title (out/demo/report.md:1).

## 8. Privacy (verbatim)

- Canonical sentence (internal/product/product.go:30; README.md:78; SECURITY.md:42; faq.md:60; SPEC.md:433): "Tokvera contacts only the target you specify, plus GitHub when you run update or doctor --check-update, and tokvera.halotrcer.com and GitHub for the plugin's first-run install." It is preceded by "No telemetry."
- README.md:80-81: "Prompts and responses never appear in a report. Cost figures are estimates from a dated rate sheet, and every report shows its date and source."
- SECURITY.md:43-59: prompts and responses never appear in a report, log or error (tests plant markers); API keys are env-only; `--prompts FILE` is read locally and never sent; the audit sends nothing by default; redirects are refused.
- FAQ "Does it work offline?" (faq.md:62-67): `tokvera scan --demo` contacts nothing at all.
- Audit: prompt text is hashed in memory and dropped (audit.md:163-166). Embeddings and LLM narrative are opt-in (audit.md:169-176).
- Caveat: "nothing leaves your machine" is NOT accurate as a blanket claim. A scan sends load to the target. `--keyless` signing writes to a public log (report-signing.md:307-309). Opt-in embeddings and the LLM narrative contact their endpoints.

## 9. SECURITY.md

- Contact: "Email **satyajit.rajaraman@halotrcer.com** with "tokvera security" in the subject. Please do not open a public issue for a vulnerability." (SECURITY.md:5-6)
- "We aim to acknowledge reports within 5 business days" (SECURITY.md:16-17).
- Pre-1.0, no maintained older lines (SECURITY.md:21-23).
- What a release proves: cosign keyless signature on checksums.txt, SLSA v1 provenance, signed packages and repos, SBOMs (SECURITY.md:27-35).
- Git log mentions "enable private reporting" (commit 3c1acf3).

## 10. Roadmap, release status, license, repo

- Roadmap (docs/roadmap.md): "Nothing here works yet, and none of it has a date." (lines 3-4). Items: suite themes; embedding-based cache potential; targets suggested from the repository; `scan --k8s`; an air-gapped bundle plus offline `tokvera verify`; scoring 1.0.0.
- Release status: CHANGELOG top section is "## Unreleased" (CHANGELOG.md:6). "### v0.2 at a glance / The first public release." (CHANGELOG.md:8-10). The scan-report schema is at v1.3.0, dated 2026-10-21 (CHANGELOG.md:79). There is one local git tag, `v0.1.0`. dist/ holds local snapshot builds (`0.1.1-snapshot-f22af4d`). PROGRESS.md:20-21: "Feature work stops; the launch-readiness review is the owner's." Draft releases need owner approval (docs/releasing.md:1-4). There is no evidence a public v0.2.0 exists; the v0.2.0 in the docs is an example. The source default version is "v0.1.0-dev" (main.go:20).
- License: Apache-2.0 (README.md:131; LICENSE). NOTICE: "Tokvera, Copyright 2026 Satyajit Rajaraman / Halotrcer" (PLAN.md:45).
- Repo: https://github.com/rajasatyajit/tokvera (install.md:4; git remote origin). Module `github.com/rajasatyajit/tokvera` (SPEC.md:405). Related repos: rajasatyajit/homebrew-tap, scoop-bucket, packages, winget-pkgs fork (PLAN.md:50), tokvera-scan-action (action/README.md:14).
- Requirements: Go 1.26+ (README.md:123).

## 11. FAQ questions (docs/faq.md)

1. Is it safe to point a scan at production? (3)
2. How much does a scan cost on a paid API? (18)
3. Why is the grade "provisional"? (24)
4. Why does the cache check say "insufficient evidence"? (31)
5. Why is there no tokens-per-second figure? (37)
6. Why does my cost figure say "not computed"? (44)
7. Why does the p99 differ from my Grafana dashboard? (51)
8. Does tokvera send anything about me anywhere? (58)
9. Does it work offline? (62)
10. What is the difference between a scan and an audit? (69)
11. Which servers does it work with? (77)
12. Something is not working (83)

## 12. Numbers in docs: what is safe to use

Safe, because each is sourced to code or config:
- Scoring weights, thresholds, bands and caps (scoring.md generated tables).
- Suite sizes (scan.md:43-47). The 256-token cap per request (scan.md:41).
- HTML report under 300 KB (report-anatomy.md:183).
- Regression limits 20%/50 ms/10% (scan.md:114-116).
- 5-business-day acknowledgement (SECURITY.md:16).
- Pricing staleness warning after 60 days (scan.md:88-90).

Simulated, and must be labelled as such:
- Demo grade D 60.8, 55/60 requests, 776 ms, p99 201 ms vs 11 ms, 16/40 repeats (README.md:25-33; testdata/demo/README.md:13-32).
- Audit demo volumes: ~16,000 support-bot calls/day, ~179,000 records. "Figures are illustrative" (audit.md:236-245).

No unsourced benchmarks or savings claims exist in the docs. There are no "X% savings" or "Nx faster" figures. Do NOT invent any.
- Marketing copy in brag-output/share-copy.txt:1-2 ("In a world where AI agents loop forever, one command tells you what it's really costing you." / "Tokvera: one command, a client-ready audit.") is unsourced framing. It also contradicts the README's "two commands" and scan-first positioning.
- audit.md "5-minute" / "10 min" (audit.md:155,160) are workflow estimates, not measurements.

## 13. PLAN / SPEC / DECISIONS items relevant to the site

- Domain `tokvera.halotrcer.com` serves /install.sh and /install.ps1 (SPEC.md:406; PLAN.md:11). Hosting "is the owner's and is not configured here" (DECISIONS.md:2155-2156). It must byte-match the scripts at the tagged commit (releasing.md:84-92).
- winget support URL is https://tokvera.halotrcer.com and the publisher URL is https://www.halotrcer.com. "both must load" (releasing.md:94-96; PLAN.md:51 R14).
- Booking URL https://www.halotrcer.com/book, held in one constant (product.go:7; SPEC.md:407).
- Brand: company "Halotrcer" (product.go:13). The client page uses a "Prepared by Halotrcer" text wordmark with no images (PLAN.md:60 R21). Package homepages point at the GitHub repo (DECISIONS.md:2535).
- Releases: rc tags (`vX.Y.Z-rc.N`) run the pipeline but reach no stable channel (PROGRESS.md:23-24).
- Scoring stays 0.9.0 until two pilot scans (PLAN.md:33 R4).
- Package repo served at https://rajasatyajit.github.io/packages/ (install.md:183; DECISIONS.md:1041).
- The schema `$id` uses tokvera.dev (schema/findings.v1.schema.json:3). This conflicts with the halotrcer domain.

## docs/ files (one line each)

- install.md: every install channel, verification, uninstall.
- scan.md: running a scan, targets, suites, caps, CI regression, exit codes.
- scoring.md: the A–F grade, weights, thresholds, caps (provisional 0.9.0).
- report-anatomy.md: what is in report.html/report.json and an audit bundle.
- report-signing.md: `report sign|verify` with cosign.
- first-run.md: init, doctor, update, uninstall, completions, man page.
- config.md: global configuration and output flags.
- troubleshooting.md: every doctor check and its fix (generated).
- faq.md: 12 common questions.
- roadmap.md: planned, unbuilt, undated items.
- agents.md: MCP server, Claude Code/Codex plugin, install-skill.
- exit-codes.md: exit-code contract for every command.
- helm.md: Helm chart for scheduled in-cluster scans.
- audit.md: the paid audit's engine, workflow, data handling, trust rules.
- audit-kit.md: consultant commands (instrument, audit report --client, stack, cache).
- kit.md: signed premium audit kits loaded with --kit.
- capture.md: capture proxy that records usage logs.
- usage-log-format.md: usage-log JSONL v1 spec.
- releasing.md: maintainer release procedure (internal; probably not for the site).
- findings-schema-detail.md: an internal "Phase 6" Claude Code prompt for the findings schema (internal; not for the site).
