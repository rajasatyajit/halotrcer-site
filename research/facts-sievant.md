# Sievant fact sheet (sourced, read-only survey of ~/workspace/aethergate)

All paths relative to `~/workspace/aethergate`. "VERBATIM" = quoted exactly. Snapshot date 2026-10-21.

## 0. Naming: aethergate vs sievant
- Canonical product name: **Sievant**. `internal/brand/brand.go:7` `Name = "Sievant"`; README title `README.md:1`.
- Go module: `github.com/rajasatyajit/sievant` (`go.mod:1`). Repo: `https://github.com/rajasatyajit/sievant` (`internal/brand/brand.go:12`).
- "aethergate" appears only as the local checkout directory name, in untracked brag artifacts: `brag-output-*/composition-brief.md:13` ("Project root: /home/satyajit/workspace/aethergate") and `brag-output/work/capture.mjs:1`. No occurrences in README, docs, code, or PLAN (grep over repo excluding node_modules/.git/dist).
- Vendor/publisher: Halotrcer. `NOTICE:1` "Sievant, Copyright 2026 Satyajit Rajaraman / Halotrcer"; winget id `Halotrcer.Sievant` (`docs/install.md:13`, `PLAN.md:887-888`).

## 1. Positioning (README, VERBATIM)
- `README.md:3-7`: "**Sievant puts a security checkpoint between AI agents and the tools they call.** It sits in front of MCP (Model Context Protocol) servers and checks every tool call: who is calling, whether they may, what goes in and what comes back. Every call is recorded in a local audit trail."
- Two ways it runs, `README.md:9-18`:
  - "**On a developer's machine,** in front of the MCP servers that Claude Desktop, Claude Code, Cursor, VS Code and Windsurf launch. `sievant scan` audits their configurations, `sievant wrap` routes the servers through Sievant, and `sievant ui` shows what happened."
  - "**As a gateway** for a team or a cluster: one process, or a Kubernetes sidecar, that serves databases, REST and gRPC APIs, Prometheus and Loki, and other MCP servers as tools, with identity, per-agent policies and rate limits."
- `README.md:20-22`: "Sievant is open source (Apache-2.0) and written in Go: one static binary with no runtime dependencies. It adds about 0.25 ms per call at the 99th percentile on a laptop; the release gate is 2 ms."
- Release notice `README.md:24-26`: "**No release has been published yet.** Until the first one, build from source: `go install github.com/rajasatyajit/sievant/cmd/sievant@latest` (Go 1.26 or newer)."
- Older positioning (v0.1.0 era, brag plan, not README): "A zero-trust MCP gateway..." `brag-output/brag-plan.md:3`; CHANGELOG 0.1.0 "First release: zero-trust MCP gateway" `CHANGELOG.md:368-370`.

## 2. What it blocks / detects
### README "What it blocks" (real recorded responses, `README.md:48-138`)
- Credential in arguments, call blocked: "Arguments contain a credential (aws_access_key); call blocked." (`README.md:57`)
- Secrets in results redacted: "the secret is [REDACTED:mcp_secret]" (`README.md:65`)
- Rug pull / tool definition changes: pinned on first use, withheld until `sievant policy pins accept` (`README.md:68-75`)
- Prompt injection in results: scored, recorded `INJECTION_SUSPECTED`, wrapped in `<untrusted-tool-output id=... injection-score=...>` markers (`README.md:77-84`); strict profile withholds high-confidence tier (`README.md:86-96`)
- Paths/URLs outside allowlist (strict or `fs-paths`/`egress` packs) (`README.md:98-111`)
- Risky client configs via scan, e.g. `CRITICAL SEC001 ... Hard-coded GitHub token` (`README.md:120-133`)
- Gateway extras: "per-agent tool allowlists, argument constraints, rate limits per agent and per tool, row and byte budgets, read-only SQL and an SSRF guard on outbound requests" (`README.md:135-138`)

### Modes
- scan: read-only audit of client configs (`docs/scan-and-wrap.md:7-12`).
- wrap: rewrites server entries to launch `sievant proxy`; backups; `unwrap` restores byte for byte (`docs/faq.md:27-34`).
- Default protection when wrapped: "credentials in arguments blocked, secrets in results redacted (including the server's own keys from its environment), tool definitions pinned on first use, suspected prompt injection marked as untrusted for the model, rate limits, and an audit record of every call" (`docs/faq.md:47-51`).
- Not wrapped: OAuth remote servers, HTTP+SSE servers, already-wrapped entries (`docs/faq.md:41-43`).
- Gateway: `sievant serve --config` stdio or Streamable HTTP (`README.md:181`, `docs/gateway.md:1-10`).
- Kubernetes: gateway mode and sidecar mode (mutating admission webhook), K8s 1.30+ (`docs/kubernetes.md:3-12`); namespace label `sievant.io/inject=enabled` (`docs/kubernetes.md:114`).

### Scan rules (`docs/scan-and-wrap.md:14-29`)
SEC001 critical (credential formats: GitHub, GitLab, Slack, Anthropic, OpenAI, Stripe, AWS, Google, Hugging Face, npm, Notion, Linear, private keys, JWTs, DB URLs with password); SEC002 high; SEC003 critical (password in server URL); SEC004 high (capability URL); PERM001/PERM002 high/medium (fs root / home); PERM003 medium; SUP001 medium (unpinned / @latest); SUP002 high (git/URL fetch, curl|sh); AUTH001 medium; NET001 high (plain HTTP remote); INJ001 high/medium (--inspect-tools); MCP001, MCP002 info; SVT001/SVT002 info.

### Profiles (`docs/policies.md:17-25`)
| observe | blocks nothing, records WOULD_BLOCK | owasp-llm |
| balanced | credentials in args, over rate limit, changed tool defs; PII redacted, injection annotated | owasp-llm |
| strict | balanced + path outside init dir, every URL until hosts listed, high-confidence injection | owasp-llm, fs-paths, egress |
"Observe mode is not a protection." (`docs/policies.md:23`)

### Packs (`docs/policies.md:93-101`)
`secrets-pii`, `injection`, `fs-paths`, `egress`, `rate-limits` ("at most 2 times a second (bursts of 10)"), `description-pinning`, `owasp-llm`.

### Connectors (`docs/connectors.md:3-9`)
SQL (Postgres via pgx, MySQL, SQLite pure Go), REST, gRPC, Prometheus and Loki, other MCP servers.

### Compatibility
- Clients: Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, plus project files `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`; others via `--config`; any MCP client can talk to proxy/gateway (`docs/faq.md:91-96`).
- MCP revisions served: 2026-07-28 and 2025-11-25 by default; 2025-06-18, 2025-03-26, 2024-11-05 when listed (`docs/compatibility.md:8-14`). JSON-RPC batches refused (`docs/compatibility.md:27-31`). HTTP+SSE transport not served (`docs/compatibility.md:33-35`).
- Upstream: stateless-2026-07-28-only servers not supported yet; sampling/elicitation/roots refused (`docs/compatibility.md:45-58`).
- Not supported in wrap: only text content passes (binary replaced by a note) (`docs/roadmap.md:62-66`).

## 3. Commands
README table `README.md:173-189`: scan, wrap --all|<server>, unwrap, ui, proxy -- <command>, init (observe|balanced|strict), serve --config, policy suggest|diff|apply, policy packs|owasp|pins, agent list|add|token, report, doctor, config show --sources, webhook, verify <bundle>.
Dispatch in `cmd/sievant/main.go:106-142` also includes: validate, hash-key, version, config, health, help.
docs/commands.md (`docs/commands.md:7-31`) lists them with one-line examples.
- Free-scan command: `sievant scan` (`README.md:34`) "read-only: what is risky in your MCP client configurations". Variants: `--json`, `--html scan.html`, `--fail-on high` (exit 3), `--inspect-tools` (`docs/scan-and-wrap.md:36-42`).
- Wrap: `sievant wrap --all` "(backs up every file first)" (`README.md:35`); with profile `sievant wrap --all --policy ~/.config/sievant/strict.yaml` (`README.md:117`).
- Gateway: `sievant serve --config <file>` (`README.md:181`).
- "Next" hints: installer prints `next: sievant scan ...` / `then: sievant wrap --all ...` (`scripts/install.sh:340-341`); scan prints "next: sievant wrap --all   (route these servers through Sievant; sievant unwrap restores the files)" (`cmd/sievant/scan.go:154`).
- Global: every command takes `--json`, honours `NO_COLOR`; exits 0 ok, 1 error, 2 usage, 3 findings at/above threshold (`README.md:191-192`, `docs/exit-codes.md:46-51`).

## 4. Install (docs/install.md, EXACT)
- Script (Linux/macOS): `curl -fsSL https://sievant.halotrcer.com/install.sh | sh` (`docs/install.md:11-12`)
- PowerShell: `irm https://sievant.halotrcer.com/install.ps1 | iex` (`docs/install.md:13`)
- Read-first: `curl -fsSLO https://raw.githubusercontent.com/rajasatyajit/sievant/main/scripts/install.sh` then `less install.sh && sh install.sh` (`docs/install.md:23-24`)
- With options: `curl -fsSL https://sievant.halotrcer.com/install.sh | sh -s -- --version v0.2.0 --require-cosign` (`docs/install.md:71`); PS: `& ([scriptblock]::Create((irm https://sievant.halotrcer.com/install.ps1))) -Version v0.2.0 -RequireCosign` (`docs/install.md:93`)
- install.sh flags: --version, --dir (default $HOME/.local/bin), --global (/usr/local/bin), --dry-run, --no-verify, --require-cosign (`docs/install.md:59-66`); ps1: -Version, -Dir ($env:LOCALAPPDATA\Programs\sievant), -Global, -DryRun, -NoVerify, -RequireCosign (`docs/install.md:81-88`)
- Scripts contact only api.github.com and github.com (`docs/install.md:50-52`). Source files: `scripts/install.sh`, `scripts/install.ps1`; "`sievant.halotrcer.com` serves the same files" (`docs/install.md:18-19`); constants `InstallShURL`/`InstallPS1URL` (`internal/brand/brand.go:16-17`).
- Homebrew: `brew install --cask rajasatyajit/tap/sievant` (`docs/install.md:122`). "**The macOS binary is not notarized by Apple.**" (`docs/install.md:125`)
- Scoop: `scoop bucket add rajasatyajit https://github.com/rajasatyajit/scoop-bucket` then `scoop install rajasatyajit/sievant` (`docs/install.md:152-153`)
- winget: `winget install -e --id Halotrcer.Sievant` (`docs/install.md:155`)
- deb/rpm local: `sudo apt install ./sievant_0.2.0_amd64.deb`, `sudo dnf install ./sievant-0.2.0-1.x86_64.rpm` (`docs/install.md:170-172`)
- Alpine: `wget -O /etc/apk/keys/satyajit.rajaraman@halotrcer.com-sievant.rsa.pub https://raw.githubusercontent.com/rajasatyajit/sievant/main/packaging/keys/satyajit.rajaraman@halotrcer.com-sievant.rsa.pub` then `apk add ./sievant_0.2.0_x86_64.apk` (`docs/install.md:180-182`)
- apt repo (`docs/install.md:198-203`):
  ```
  sudo install -d -m 0755 /etc/apt/keyrings
  sudo curl -fsSLo /etc/apt/keyrings/halotrcer-packages.asc \
    https://rajasatyajit.github.io/packages/halotrcer-packages.asc
  echo "deb [signed-by=/etc/apt/keyrings/halotrcer-packages.asc] https://rajasatyajit.github.io/packages/apt stable main" |
    sudo tee /etc/apt/sources.list.d/sievant.list
  sudo apt update && sudo apt install sievant
  ```
  Key fingerprint `D2D9 6618 831A C55B 81E2  4DA3 039B 5DA0 D3E3 9071` (`docs/install.md:191-192`)
- dnf/yum repo: `sudo curl -fsSLo /etc/yum.repos.d/sievant.repo https://rajasatyajit.github.io/packages/rpm/sievant.repo` then `sudo dnf install sievant` (`docs/install.md:210-211`)
- systemd gateway service steps (`docs/install.md:227-231`)
- Docker: `docker run --rm ghcr.io/rajasatyajit/sievant:latest version` (`docs/install.md:16`); distroless, non-root uid 65532, amd64+arm64 (`docs/install.md:239-240`); compose quickstart in `examples/compose` (`docs/install.md:241-243`)
- Helm (`docs/install.md:263-264`): `helm install sievant oci://ghcr.io/rajasatyajit/charts/sievant --version 0.2.0 --namespace sievant --create-namespace -f values.yaml`; chart source `charts/sievant/`
- go install: `go install github.com/rajasatyajit/sievant/cmd/sievant@latest` (`docs/install.md:14`)
- GitHub releases: archives at `https://github.com/rajasatyajit/sievant/releases/download` (`docs/install.md:110-111`)
- Air-gapped: bundle `sievant_<version>_airgap_<os>_<arch>.tar.gz`; `sievant verify sievant_0.2.0_airgap_linux_amd64.tar.gz` (`docs/install.md:290-301`)
- cosign checksum verification VERBATIM (`docs/install.md:133-139`):
  ```
  TAG=v0.2.0   # the version you installed: sievant version
  curl -fsSLO "https://github.com/rajasatyajit/sievant/releases/download/$TAG/checksums.txt"
  curl -fsSLO "https://github.com/rajasatyajit/sievant/releases/download/$TAG/checksums.txt.sigstore.json"
  cosign verify-blob --bundle checksums.txt.sigstore.json \
    --certificate-identity-regexp '^https://github\.com/rajasatyajit/sievant/\.github/workflows/release\.yml@refs/tags/v' \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com \
    checksums.txt
  ```
  "`Verified OK` means the file was signed by this repository's release workflow running on a version tag." (`docs/install.md:142-143`); then `shasum -a 256 sievant_*_darwin_*.tar.gz` (`docs/install.md:144`)
- Image: `cosign verify ghcr.io/rajasatyajit/sievant:v0.2.0 --certificate-identity-regexp '...' --certificate-oidc-issuer https://token.actions.githubusercontent.com` (`docs/install.md:247-249`); chart cosign + `gh attestation verify oci://ghcr.io/rajasatyajit/charts/sievant:0.2.0 ...` (`docs/install.md:258-262`)
- SLSA: `gh attestation verify sievant_0.2.0_linux_amd64.tar.gz --repo rajasatyajit/sievant --signer-workflow rajasatyajit/sievant/.github/workflows/release.yml` (`docs/install.md:278-281`)
- By hand: `sha256sum --ignore-missing -c checksums.txt` (`docs/install.md:320`)
- Uninstall per channel (`docs/install.md:327-331`).
- Missing / caveats: no release published (`README.md:24`); `sievant.halotrcer.com` "has no DNS record yet (2026-10-20), so /install.sh and /install.ps1 do not load" (`PLAN.md:853-857`); apt/yum repos "From the first release on" (`docs/install.md:187`); winget may lag (MS review) (`docs/install.md:158-159`); Artifact Hub listing not done (`docs/releasing.md:170-176`, `PLAN.md:861-865`); no macOS notarization; no npm/pip/Nix/Chocolatey/snap channel mentioned anywhere in docs/install.md; `sievant update` / `uninstall` / completions / man page are roadmap only (`docs/roadmap.md:180-187`). Version 0.2.0 in examples is the planned first release (rc first: `v0.2.0-rc.1`, `PLAN.md:844-849`).

## 5. Report
- Command `sievant report --period 30d --org "Example Co"` writes `sievant-report-<date>.html` and `.pdf` (`docs/report.md:8-12`). Formats html,pdf,json (`docs/report.md:100`). JSON `report_version: 1` (`docs/report.md:113`).
- No standalone JSON Schema file for either report. Schema = Go structs: posture report `pkg/report/report.go:62` (Version const at `:25`); scan report `pkg/scan/report.go:13-23` (`ReportVersion = 1`). Only schema files in repo: `config.schema.json`, `charts/sievant/values.schema.json`.
- Posture report top-level JSON fields (from `pkg/report/testdata/golden/gateway.json`): report_version, generator, generated_at, organization, period, sources, summary, architecture, controls, activity, gaps, questionnaire, owasp_mapping, disclaimer, cta.
- Scan report top-level fields (from `testdata/scan/report.golden.json`): report_version, generator, generated_at, tools_inspected, files, findings, counts, notes.
- Sections: architecture, controls in force, activity, coverage gaps, questionnaire topics, sources/method + disclaimer (`docs/report.md:59-89`). HTML is self-contained, no scripts, light/dark (`docs/report.md:109-110`).
- Disclaimer VERBATIM (`pkg/report/report.go:221-223`): "This report describes how Sievant is configured and what its audit trail recorded in the period. It is generated by the software from local data; it is not a certification, an audit or an attestation, and it covers only the MCP traffic that passes through Sievant."
- CTA: "Want a professional review of this setup?" (`pkg/report/report.go:226`) linking https://www.halotrcer.com/book; `--no-cta` removes it (`docs/report.md:91-92`).
- Committed samples (candidates for website demos):
  - `pkg/report/testdata/golden/{gateway,gateway-no-cta,no-audit}.{html,json,pdf,txt}` — synthetic test fixtures; regenerated via the `-update` flag in `pkg/report/report_test.go:27,171`.
  - `testdata/scan/report.golden.json` — scan of synthetic fixtures in `testdata/scan/` (fake tokens, `testdata/scan/README.md:1-15`); regenerate with `SIEVANT_UPDATE_GOLDEN=1` (`pkg/scan/scan_test.go:157`).
  - `cmd/sievant/testdata/golden/report_local_summary.txt` — terminal summary sample ("controls: 7 of 12 enforced, 3 partial, 2 off").
  - `docs/screenshots/{topology,traces,security,saturation}.png` (tracked) — dashboard screenshots from `make screenshots` (`Makefile:243-244`).
  - `brag-output*/` (brag.mp4, brag.jpg, brag-plan.md, share-copy.txt) — launch videos from the brag skill; NOT tracked by git (not in `git ls-files`); describe the v0.1.0 gateway era.

## 6. Scoring / grades
- NONE implemented. Roadmap only: "An exposure score: an A to F grade from weighted pillars (secrets, permissions, supply chain, prompt-injection exposure, auditability), with the weights published and versioned... failing on a grade is opt-in." (`docs/roadmap.md:202-207`). No thresholds published. `scan --demo` also roadmap (`docs/roadmap.md:197-201`); PLAN milestone M9A (`PLAN.md:86`). Exit code 3 "reserved for `scan --fail-on` and `--fail-under` (M2, M9A)" (`docs/exit-codes.md:51`). `--fail-on` exists today (`docs/scan-and-wrap.md:40`).

## 7. OWASP LLM Top 10 mapping
- Disclaimer VERBATIM (`docs/owasp-llm-mapping.md:3`; same in `internal/defaults/packs/owasp-llm-2025.yaml:10-15`): "This maps Sievant's controls to the OWASP Top 10 for LLM Applications categories they address. It is not a compliance certification, an audit or an assessment of any system, and it does not mean a category's risk is fully mitigated: each control addresses part of a category, within what an MCP gateway can see."
- CLI help: "(a mapping of controls to categories, not a certification)" (`cmd/sievant/policycmd.go:52`). `sievant policy owasp [--json]` prints the embedded YAML (`docs/owasp-llm-mapping.md:5`).
- Edition 2025, mapping version 1, retrieved 2026-10-18 (`docs/owasp-llm-mapping.md:5`).
- Table (`docs/owasp-llm-mapping.md:11-20`):
  - LLM01 Prompt Injection: injection-detection, tool-pinning, withheld-primitives
  - LLM02 Sensitive Information Disclosure: argument-rules, input-sanitization, output-redaction, withheld-primitives, scan
  - LLM03 Supply Chain: tool-pinning, scan
  - LLM04 Data and Model Poisoning: Not addressed ("Training and fine-tuning data are outside an MCP gateway's view.")
  - LLM05 Improper Output Handling: argument-constraints
  - LLM06 Excessive Agency: policies, argument-constraints, argument-rules, ssrf-guard, scan
  - LLM07 System Prompt Leakage: Not addressed
  - LLM08 Vector and Embedding Weaknesses: Not addressed
  - LLM09 Misinformation: Not addressed
  - LLM10 Unbounded Consumption: rate-limits, output-budgets
- Controls table with config keys `docs/owasp-llm-mapping.md:24-38`. `audit-trail` maps to no category.

## 8. Paid offering "Agent Security Review"
- ABSENT. The string "Agent Security Review" appears nowhere (grep of README, docs, PLAN, CHANGELOG, pkg, cmd, internal). `docs/audit.md` is "Audit and dashboard" (the audit trail and embedded dashboard, `docs/audit.md:1-5`), not a paid service; no prices anywhere.
- Only commercial hooks: report footer "Want a professional review of this setup?" → `https://www.halotrcer.com/book` (`pkg/report/report.go:226`, `internal/brand/brand.go:18-20`), which "returns 404" as of 2026-10-20 (`PLAN.md:856-857`). FAQ: "The single sign-on interface (OIDC identity for agents) is reserved for a possible commercial edition" (`docs/faq.md:121-124`).

## 9. Privacy / telemetry (VERBATIM)
- `README.md:142-151`: "**Sievant sends no telemetry.** It contacts only the servers and backends you configure. The audit trail is a SQLite file on your machine. ... It never holds raw arguments, only a keyed hash of them, and it never holds results. Nothing leaves the machine unless you configure an export (OTLP, syslog or a webhook...). `sievant ui` listens on 127.0.0.1 only, behind a one-time link."
- `docs/faq.md:5-6`: "No. Sievant sends no telemetry and has no account or license check."
- `docs/telemetry.md:3-6`: export "Both are off unless configured; with neither, no work is added to a call." Export types OTLP/HTTP logs, syslog RFC 5424, signed webhook (`docs/telemetry.md:18-32`); OTel traces (`docs/telemetry.md:62-77`).
- Report: "It only reads; nothing is changed and nothing leaves the machine." (`docs/report.md:19`)
- Audit DB location: `~/.local/state/sievant` / `%LOCALAPPDATA%\sievant` (`docs/faq.md:15-17`).

## 10. SECURITY.md / threat model
- Report to satyajit.rajaraman@halotrcer.com, subject "sievant security", or GitHub private reporting; acknowledge within 5 business days (`SECURITY.md:5-20`).
- "Sievant is a security control, so a way around it is a vulnerability." (`SECURITY.md:23`); missed injection is a detection gap, not a vuln (`SECURITY.md:39-43`).
- "Sievant is before 1.0. ... no maintained older release lines." (`SECURITY.md:47-48`)
- Release proofs: cosign keyless checksums, SLSA v1 provenance on archives/packages/SBOMs/image/chart, signed packages, SBOMs per archive (`SECURITY.md:52-61`).
- Threat model sections (`docs/threat-model.md`): DoS via connection/TLS-handshake exhaustion (:7), observe mode (:82), rug pulls (:97), path & URL arguments (:116; residual risk: checks argument text, does not resolve, :127), credentials in command lines/URLs (:133), per-agent keys on one machine (:168), plain HTTP for in-pod sidecar (:190), sidecar injector (:220), MCP tasks (:255). "This document grows with each milestone; M10 completes it." (`docs/threat-model.md:3`)
- Policies doc: "**Detection is not the defence.**" (`docs/policies.md:145`).

## 11. Roadmap / release / license
- CHANGELOG: `[Unreleased]` (`CHANGELOG.md:7`) on top of `[0.1.0]` (`CHANGELOG.md:366`). A local `v0.1.0` git tag exists but "The release tag `v0.1.0` predates this pipeline" (`docs/releasing.md:179`) and README says no release published (`README.md:24`). Planned next: `v0.2.0-rc.1` then `v0.2.0` (`PLAN.md:844-849`). Repo must be made public before the first tag (`PLAN.md:837-839`) — i.e. repo currently not public.
- License: Apache License 2.0 (`LICENSE:1-3`, `README.md:220`, `docs/faq.md:121`).
- Roadmap items (`docs/roadmap.md`): sievant update/uninstall/completions; GitHub Action `sievant-scan-action`; scan --demo; A–F exposure score; scan suites; compliance mapping in report (OWASP, NIST AI RMF, ISO/IEC 42001, EU AI Act); incident reconstructions; `report sign/verify`; `sievant mcp`; plugins for Claude Code and Codex, `install-skill`; local read-only API with iFixAi adapter; per-server PII rules; opt-in binary content; faster CI. "There are no dates" (`docs/roadmap.md:3`).

## 12. FAQ questions (`docs/faq.md`)
Does Sievant send anything anywhere? (:3) / What does the audit trail keep? (:10) / Will it slow my agent down? (:20) / What exactly does `sievant wrap` change? (:27) / Will my MCP servers still work after wrapping? (:36) / Does wrapping protect anything without further setup? (:45) / What is the difference between the profiles? (:54) / How reliable is the prompt-injection detection? (:70) / Does Sievant see my API keys? (:81) / Which clients does it support? (:89) / How do I upgrade? (:98) / How do I remove Sievant? (:106) / Does it run on Kubernetes? (:113) / Is it free? Is there a commercial edition? (:119) / How do I report a vulnerability? (:126)

## 13. Numbers (flag: all self-measured on author hardware)
- ~0.25 ms p99 per call on a laptop; release gate 2 ms (`README.md:21-22`, `docs/faq.md:22-24`). BASELINE: BenchmarkChain p99 345 µs baseline (`BASELINE.md:76,112`); TestPolicyEvalBudget p99 322–348 µs (`BASELINE.md:128,160`). Note: README's 0.25 ms vs BASELINE's ~0.33–0.35 ms chain p99 differ — FLAG, verify source before quoting (README says FAQ "BASELINE.md has the measurements").
- Loadtest ~1104 req/s, 500 clients/200 in flight against 200 ms tool, client p99 598 ms, peak RSS 99.3 MB (`BASELINE.md:79-84,115,162`).
- Dashboard at ~1,000 calls/s: ~60 fps all views, Ryzen 7 6800H (`docs/audit.md:266-286`); embedded UI 107 KB (34 KB gzipped) (`docs/audit.md:293-294`).
- Injection detection (`docs/policies.md:129-138`): high tier 0 of 1754 false positives, catches 36 of 2907 (1.2%) on independent corpus; standard tier 79/1754 FP (4.5%), catches 983/2907 (33.8%); "Zero of 1,827 benign samples bounds the high tier's false-positive rate at about 0.16% (95% confidence), not at zero."
- Brag plan claims "about 245 µs" chain and "idle memory is about 33 MiB" (`brag-output/brag-plan.md:5`) — FLAG: untracked, not in docs.
- Counts: 5 supported clients; 15+ scan rule IDs; 3 profiles; 7 packs; 10 OWASP categories (6 addressed, 4 not); 5 MCP revisions; 6 cross-compile platforms (`BASELINE.md:161`).

## 14. PLAN.md items relevant to website
- Brand constants in one place `internal/brand` (`PLAN.md:55-58`, `internal/brand/brand.go:5-30`): Domain `sievant.halotrcer.com` "serves the website and the install scripts" (`brand.go:13-14`); BookingURL `https://www.halotrcer.com/book`; ContactEmail.
- Website TODO (`PLAN.md:853-857`): "The website serves the install scripts and the booking page (website project): `https://sievant.halotrcer.com` has no DNS record yet (2026-10-20), so `/install.sh` and `/install.ps1` do not load ..., and `https://www.halotrcer.com/book`, the report's review offer, returns 404. Both before the release tag."
- Release step 5 requires byte-exact serving: `curl -fsSL https://sievant.halotrcer.com/install.sh | cmp - scripts/install.sh` (and .ps1) (`docs/releasing.md:78-86`). winget manifest names `https://sievant.halotrcer.com` as support URL and `https://www.halotrcer.com` as publisher URL; "both must load" (`docs/releasing.md:88-90`).
- README at release: remove "no release yet" note (`PLAN.md:858-860`).
- `ui/` is the Svelte dashboard embedded in the binary (`PLAN.md:27`), not a website. Sibling product Tokvera shares packages repo/key (`PLAN.md:884-886`).

## docs/ files
- audit.md: audit trail (SQLite) and embedded gateway dashboard, perf numbers
- commands.md: one-block list of every command
- compatibility.md: MCP protocol revisions, tasks, progress
- configuration.md: config file location, precedence, output, connection limits
- connectors.md: SQL, REST, gRPC, Prometheus/Loki, MCP upstream connectors
- development.md: build, verification, repo layout
- exit-codes.md: exit codes 0–3
- faq.md: 15 common questions
- gateway.md: transports, guardrail chain, injection detection, config reference
- install.md: every install channel and verification
- kubernetes.md: Helm chart gateway and sidecar modes
- local-quickstart.md: install, scan, wrap, ui, unwrap walkthrough
- owasp-llm-mapping.md: OWASP LLM Top 10 2025 control mapping
- policies.md: profiles, packs, injection tiers and measurements, suggest/apply
- releasing.md: release checklist and pipeline
- report.md: `sievant report` posture report
- roadmap.md: planned features, no dates
- scan-and-wrap.md: scan rules, wrap mechanics, local UI
- telemetry.md: OTLP/syslog/webhook audit export and OTel traces
- threat-model.md: threats and mitigations per feature
- troubleshooting.md: common failures and fixes
- screenshots/: 4 dashboard PNGs
