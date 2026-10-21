---
title: Scanning an endpoint
source:
  repo: tokvera
  path: docs/scan.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 0
---

`tokvera scan` measures one inference endpoint and grades it A–F. It is free,
needs no configuration file, and contacts only the target you give it.

```sh
tokvera scan --demo                                              # the built-in simulator: no endpoint, no keys
tokvera scan --target http://localhost:8000/v1 --dry-run         # the plan; contacts nothing
tokvera scan --target http://localhost:8000/v1                   # plan, a confirmation, then the load
```

## Targets

- **OpenAI-compatible servers:** vLLM, TGI, Ollama, llama.cpp's server and
  others. Pass their base URL (`http://host:port/v1`).
  - The scan reads `/v1/models` to find the model.
  - When the server lists several models, pass `--model`.
  - It reads the server's identity endpoints to name the family it found
    (vLLM, TGI, Ollama, llama.cpp). That is a suggestion shown in the plan,
    not a setting.
- **The OpenAI and Anthropic APIs:** `--target https://api.openai.com/v1` or
  `https://api.anthropic.com/v1`.
  - The key comes from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, or from the
    variable `--api-key-env` names.
  - The key itself is never a flag and never appears in output.
  - An Anthropic target needs `--model`.
- **`--kind openai_compatible|anthropic`** overrides the protocol inferred
  from the host.
- **Refused targets:** a link-local or cloud-metadata address (for example
  `169.254.169.254`) is refused unless `--allow-private-target`. A loopback or
  private address is fine.
- **When `--target` is missing,** the scan lists the targets your environment
  suggests and stops. The suggestions come from `OPENAI_BASE_URL`,
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and `OLLAMA_HOST`, and nothing is
  probed. It never picks a target on its own; with `--yes`, only an explicit
  `--target` is used.

## The load, and its limits

A scan sends real requests: one fixed, harmless benchmark prompt each, at most
256 completion tokens, at stepped concurrency.

| Suite | Levels | Requests |
|---|---|---|
| `quick` | 1, 2, 4 | 8 per level, 24 in all |
| `standard` (default) | 1, 2, 4, 8, 16 | 20 per level, 100 in all |
| `deep` | 1, 2, 4, 8, 16, 32 | 50 per level, 300 in all |

`tokvera list suites` prints the same table.

- **The plan comes first:** suite, levels, request cap, token budget and the
  worst-case cost. On a terminal the scan asks before sending; `--yes`
  answers for a script, and without a terminal `--yes` is required.
- **`--dry-run`** prints the plan and contacts nothing.
- **Hard caps:**
  - **`--max-requests N`** caps requests across all levels.
  - **`--max-cost USD`** becomes a token budget at the model's top rate. It
    is refused when the model has no rate, because the cap could not be
    enforced.
  - **`--rate R`** limits request starts per second.
  - **`--request-timeout`** (default 60s) bounds each request.
  - **The suite's token budget** caps generation.
- **Ctrl-C** stops the load and writes the partial report, marked as
  cancelled.

## What is read besides the load

- **`/metrics`** on the target's origin, during the load, for the
  observability check. `--no-metrics` skips it.
- **GPU utilization** (a preview check, never counted in the grade):
  - `nvidia-smi` runs only for a loopback target, on this machine; `--no-gpu`
    skips it;
  - or a DCGM exporter named with `--dcgm-url`.
- **`--prompts FILE`:** a sample of your real prompts, one per line or JSONL
  `{"prompt": ...}`. It is analysed locally for exact repeats (cache
  potential) and **never sent**. The prompt text is discarded after counting.
  Without it, the cache check is "insufficient evidence": the benchmark's own
  prompts say nothing about your traffic.

## Cost figures

- **The rate:** cost per 1,000 requests comes from a rate sheet: the
  embedded one, or yours with `--pricing FILE`.
- **Labelling:** every figure is an estimate, shown with the sheet's as-of
  date and source, in the terminal, the HTML and `report.json`.
- **No row, no figure:** a model with no row on the sheet gets "not computed",
  never a guessed price.
- **A stale sheet:** once the embedded sheet is more than 60 days past its
  as-of date, the scan warns and the report says so. `tokvera doctor` shows
  its age.

## What you get

- **`report.html`** is one self-contained page (no external requests, under
  300 KB) with the grade, the findings ranked by impact, the measurements,
  and what each finding means and how to fix it.
- **`report.json`** is the same as data, schema `tokvera.scan-report/v1.x`.
  It only ever gains fields.
- Both go to `--out DIR` (default `tokvera-scan`), with the "Want this
  fixed?" footer unless `--no-cta`.
- **More:** [report-anatomy.md](report-anatomy.md) walks through both files,
  and [scoring.md](scoring.md) explains the grade and every check.

## In CI: catching a regression

```sh
tokvera scan --target "$ENDPOINT" --suite quick --yes --out new
tokvera scan summary --report new/report.json --baseline baseline/report.json
```

- **What is compared:** `scan summary` compares p95 time to first token and
  p95 request duration at every level both reports measured, and the
  estimated cost per 1,000 requests.
- **When it fails:** it exits 1 when a p95 grew by more than 20% *and* by at
  least 50 ms, or the cost by more than 10%. `--max-latency-regression`,
  `--min-latency-delta-ms` and `--max-cost-regression` change the limits.
- **Gating on the grade:** `scan --fail-under C` exits 4 when the grade is
  worse than C (opt-in).
- **Ready-made:** the GitHub Action ([action/README.md](../action/README.md))
  wraps all of this, and the Helm chart ([helm.md](helm.md)) runs it on a
  schedule in a cluster.

## Exit codes

- 0: a report was written (including a partial one after Ctrl-C, and a
  dry run).
- 1: a runtime error, or the plan was declined.
- 2: a usage error, including no terminal without `--yes`.
- 4: the grade is below `--fail-under`.

[exit-codes.md](exit-codes.md) lists every command.
