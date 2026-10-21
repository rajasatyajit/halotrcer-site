---
title: The audit
source:
  repo: tokvera
  path: docs/audit.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 10
---

`tokvera audit` is the paid engagement's engine. It takes a client's exported
telemetry (OTLP traces, usage logs, optionally a live benchmark), finds where
time and money go, and writes a client-ready bundle:
- a report;
- findings with their evidence;
- a prioritized plan;
- a fix pack of tested artifacts;
- notes for the consultant who reviews it.

The free `tokvera scan` (docs/scan.md) checks one endpoint from the outside;
the audit reads what the client's own systems recorded.

## The 5-minute first client audit

The whole job is: get data out of the client, describe it in one YAML file,
run one command, then review the checklist. Everything else is automated.

**1. Export the client's data (10 min, on the client's machine).**
Either OTLP JSON traces (Collector file-exporter output) into `data/traces/`,
or lines in the Tokvera usage-log format ([usage-log-format.md](usage-log-format.md))
into `data/usage/` — clients without OpenTelemetry can export from their own
logs. Prompt text is hashed in memory during ingest and then dropped: it never
appears in any output file, log or error, and the end-to-end run proves it by
grepping the whole bundle for a planted canary. What leaves the machine depends
on two settings, and both are explicit:

- **embeddings**: with `embedding.provider: ollama|openai_compatible`, the raw
  prompt texts are POSTed to the endpoint you configured. A non-loopback host
  additionally requires `embedding.allow_remote: true` and is refused without it;
  `provider: none` (the default) sends nothing anywhere.
- **the narrative stage** (`llm.mode: remote|local`) sends the findings document
  — scope names, measurements, evidence references — to the configured provider.
  It never receives prompt or completion text; `llm.mode: off` (the default)
  makes no call at all.

The endpoint hosts are disclosed in the bundle's coverage section and
`run-manifest.json`, so a reviewer can see which of these ran.

**2. Write `audit.yaml` and `pricing.yaml`.**
Start from the fully commented [examples/audit.example.yaml](../examples/audit.example.yaml)
and [examples/pricing.example.yaml](../examples/pricing.example.yaml). Config
decoding is strict and validation reports every problem at once, so a typo is
a message, not a silent default. Fill the pricing table from the providers'
own pricing pages and date it — the tool never invents a price or a model ID.
`confidence:` sets the thresholds that turn a detector's numeric score into the
word a client reads (High / Medium / Low); the number stays in findings.json.

**3. Run.**

```sh
tokvera audit --config audit.yaml
```

Exit 0 means a bundle exists in `<output.dir>/<audit_id>/` — including when
the LLM fell back to the deterministic template narrative. Non-zero only for
an invalid config (exit 2, every problem listed) or an unreadable input
(exit 1, the path is named). The bundle:

```
report.md  report.html  findings.json  fixpack/<playbook-id>/…  fixpack/shared/…
review-notes.md  run-manifest.json  DELIVERY-CHECKLIST.md  (bench-results.json when benched live)
```

**4. Review the checklist, then present.**
`DELIVERY-CHECKLIST.md` is generated from what actually happened in the run —
confirm the pricing `as_of`, approve the draft playbooks used, resolve the
reviewer's issues, sanity-check the top impact estimates and the skipped
detectors, and confirm the scope names are OK to show the client. It also says
how far the fix pack was checked: with the Go toolchain on PATH the rendered
modules are compiled, vetted and race-tested during the audit, so an artifact
that cannot build is caught before delivery (`--skip-fixpack-validation` opts
out, and the checklist then states that only structural checks ran). Human
involvement after the run is reviewing the draft and presenting it.

Optional live latency measurement: set `bench.enabled: true` **and**
`bench.authorized: true` (the audit sends zero load without the second flag).
Bench once at the client, then re-analyze offline forever by pointing
`bench.replay:` at the saved `bench-results.json` — replays are byte-reproducible.

## Try it without a client

```sh
make build
./bin/tokvera demo --dir out     # full pipeline, built-in simulated data, mock LLM
open out/demo/report.html        # print-ready; carries the simulated-data banner
```

`tokvera demo` runs the real pipeline (ingest → bench-free detectors → playbooks
→ fix pack → report) on the simulator's workloads — a healthy pipeline, a
runaway loop, an uncached redundant stream, a GPU-bottlenecked endpoint, a
planning agent planted as a false-positive trap that must never be flagged, and
one service whose model calls reach the logs but never the traces, so the
instrumentation check has something real to report. It GENERATES that data at
its own volume profile — a mid-size client's daily traffic, spread over three
days: roughly 16,000 support-bot calls a day, ~6,000 summaries, ~4,000 digests
and smaller agent services under them, about 179,000 analyzed records
(`internal/sim/generate.go`'s `ProfileDemo` is the table of record, and it is a
profile constant, not a fixture). Three days is longer than the audit's minimum
for a monthly figure (`detectors.min_window_for_monthly`), so the sample's
projections are stated with the confidence the window supports. Committed
fixtures, unit tests and `make e2e` stay on the small `test` profile that runs
in milliseconds. Figures are illustrative, and the bundle says so on the first
line.

## The observability deliverable runs here too

`deploy/observability/` is a docker compose stack (Collector + Prometheus +
Grafana, pinned images) provisioned with the fix pack's **rendered** collector
config, recording rules and dashboard, so the queries a client runs are the
ones the audit shipped.

```sh
make stack-render   # regenerate deploy/observability/provisioning from templates
make stack-check    # validate the compose project
make stack-up       # start it (creates the trace directory, runs the collector as you)
make integration    # the rendered instrumentation against the real collector
```

## How it stays trustworthy

- **Code computes every number.** The LLM writes prose with `{{m:…}}`
  placeholders; the renderer substitutes measured values. A free-standing
  quantity in model prose is a guardrail rejection, retried, then a
  deterministic template fallback — the audit never fails because of the LLM.
  A placeholder names the statistic too (`{{m:ID:ttft:p95}}`), because a
  finding can measure one name at several stats and a name alone picks wrongly.
- **The client report never talks about itself.** How the prose was produced,
  which playbooks are draft, and what was not compiled are written to
  `review-notes.md` and `run-manifest.json`; a test fails if pipeline
  vocabulary reaches `report.md` or `report.html`.
- **A projection is labelled as one.** Figures extrapolated from a window
  shorter than `detectors.min_window_for_monthly` lead with what the window
  recorded, and the monthly number carries a low-confidence label.
- **Everything traces to evidence**: findings carry measurements and evidence
  refs; recommendations cite finding and playbook IDs; fix-pack artifacts come
  only from tested templates.
- **Deterministic**: the same inputs, config, and LLM responses produce
  byte-identical bundles apart from `generated_at` — enforced by two replayed
  audits in `make e2e`.
- **Nothing is invented**: prices and model IDs come only from the client's
  config; missing data becomes a coverage note, never a zero or a guess.

## Around the audit

- **Signing:** `tokvera report sign` signs a bundle (docs/report-signing.md).
- **Branded page:** `tokvera audit report --client` renders the delivered
  report as one branded page (docs/audit-kit.md).
- **Premium content:** an audit kit (`--kit`) adds playbooks and fix-pack
  templates at run time (docs/kit.md).
- **Collecting data:** `tokvera capture` records usage from a client that has
  no OpenTelemetry (docs/capture.md).
