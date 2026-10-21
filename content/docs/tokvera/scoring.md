---
title: The Tokvera Efficiency Score
source:
  repo: tokvera
  path: docs/scoring.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 1
---

> **Provisional scoring.** Scoring is at version 0.9.0. The weights and
> thresholds below have not yet been calibrated against real pilot scans, and
> they may change before 1.0.0. Every report says so beside its grade
> (`score.provisional: true` in `report.json`). The version will be promoted to
> 1.0.0 only after calibration against at least two real pilot scans.

`tokvera scan` grades an inference endpoint from A to F. The grade summarizes
the checks in the report. It sits beside them and never replaces them: every
check's measured value, threshold and status are in `report.json` and the HTML
report, and a reader who disagrees with a threshold can re-grade from those
numbers.

The thresholds and weights below are **judgement**, not measurement. They are
published here, applied by `pkg/score` and versioned by `scoring_version`. The
tables at the end of this page are rendered from the code, and a test fails if
the two ever differ.

## How a grade is computed

1. Each check compares one measured value with two inclusive bounds and comes
   out `pass`, `warn` or `fail`. A check the scan could not measure (no
   successful request at the level it reads, a server that never reported
   usage, no `--prompts` sample) is `insufficient_evidence`.
2. A graded check scores **pass 100, warn 50, fail 0**. A pillar's points are
   the mean of its graded checks.
3. `insufficient_evidence` and **preview** checks are never counted. They are
   still reported, under "not counted" with the reason. A pillar with no graded
   check is left out, and the remaining weights are renormalized so they sum to
   one. `effective_weight` in `report.json` shows the weights that were applied.
4. The points are the weighted mean of the pillar points (0–100, one decimal),
   and the band they reach is the uncapped grade.
5. **Mandatory-minimum caps** then bind the grade: when one applies, the grade
   can be no better than the cap, whatever the points. Every applying cap is
   recorded in `caps_applied`, and `uncapped_grade` keeps the band the points
   earned. A cap never raises a grade.
6. There is **no letter** (`grade: "insufficient_evidence"`, with a reason)
   when the reliability pillar has no graded check, or when fewer than two
   pillars could be graded. A grade that rests on one pillar would be a claim
   about properties the scan did not see.

`--fail-under <grade>` makes `tokvera scan` exit 4 when the grade is worse
than the one given. It is opt-in, and a scan with no grade counts as below
every floor: a gate cannot pass on evidence the scan does not have.

## What the checks measure

- **Latency.** Time to first token is measured from the moment the request
  was written to the first non-empty content chunk. "p95" and "p99" are exact
  nearest-rank percentiles over the samples (the same rule as the audit), never
  interpolated. The load ratio is p99 at the highest concurrency level that had
  successful requests, over p99 with one request at a time. The chunk-gap
  check reads the gap between content chunks. A server may pack several tokens
  into one chunk, so this is an upper bound on per-token latency and is named
  for what was counted.
- **Reliability.** A request that did not stream a reply (an error status, a
  timeout, a broken stream) counts as failed.
- **Capacity.** The generation-rate ratio uses the per-stream token rate when
  every compared stream reported its usage. Otherwise it uses the per-stream
  chunk rate, and the report says which. The ratio compares the same server
  with itself, so the unit cancels, but a chunk rate is never called a token
  rate.
- **Observability.** Whether the streams stated their token usage (without it,
  cost cannot be attributed per request), and whether the server publishes
  Prometheus metrics at `/metrics` on the target's origin.
- **Cost and cache.** Repeat prompts are counted in a sample the user supplies
  with `--prompts`, after whitespace normalization, and only where the sample is
  what actually reached the model. The sample is read locally and never sent.
  The built-in load prompts say nothing about real traffic, so without
  `--prompts` this check is `insufficient_evidence`. Cost per 1,000 requests is
  reported as a measurement, not graded: there is no threshold for "too
  expensive" that holds across workloads.
- **Preview.** GPU utilization (from `nvidia-smi` for a loopback target, or an
  explicit `--dcgm-url`) is reported but not counted, because a GPU shared with
  other work makes its reading ambiguous.

## Versioning

`scoring_version` follows semantic versioning. A new check or a changed
threshold is a minor version; a new pillar or a changed weight scheme is a
major version. Reports carry the version they were graded with, so two reports
are comparable only when their versions match.

A `0.x` version is **provisional**, and `score.provisional` is derived from
it. The first calibrated release will be 1.0.0. That promotion is a decision
recorded in DECISIONS.md, never a side effect of another change.

## Scoring tables

<!-- BEGIN GENERATED: pkg/score.Markdown() -->
Scoring version: `0.9.0`

**Provisional scoring.** The weights and thresholds are provisional: they have not yet been calibrated against real pilot scans and may change before scoring 1.0.0.

#### Pillar weights

| Pillar | Weight |
| --- | --- |
| `latency` | 35 |
| `reliability` | 30 |
| `capacity` | 15 |
| `observability` | 10 |
| `cost_and_cache` | 10 |

#### Checks

| Check | Pillar | Measures | Pass | Warn | Fail | Counted |
| --- | --- | --- | --- | --- | --- | --- |
| `ttft_p95_at_concurrency_1` | `latency` | Time to first token, p95, one request at a time (ms) | ≤ 800 | ≤ 2000 | > 2000 | yes |
| `ttft_p99_load_ratio` | `latency` | Time to first token under load: p99 at the highest level over p99 at one request (ratio) | ≤ 2 | ≤ 4 | > 4 | yes |
| `inter_chunk_p95_at_concurrency_1` | `latency` | Gap between streamed chunks, p95, one request at a time (ms) | ≤ 100 | ≤ 250 | > 250 | yes |
| `error_rate` | `reliability` | Failed requests, all levels (share) | ≤ 0.01 | ≤ 0.05 | > 0.05 | yes |
| `error_rate_at_peak` | `reliability` | Failed requests at the highest concurrency level (share) | ≤ 0.01 | ≤ 0.05 | > 0.05 | yes |
| `generation_rate_load_ratio` | `capacity` | Per-stream generation rate at the highest level over one request (ratio) | ≥ 0.7 | ≥ 0.4 | < 0.4 | yes |
| `usage_reported_share` | `observability` | Streams that reported their token usage (share) | ≥ 1 | ≥ 0.5 | < 0.5 | yes |
| `metrics_endpoint` | `observability` | Prometheus metrics served at /metrics (present) | present | absent | never | yes |
| `repeat_prompt_share` | `cost_and_cache` | Prompts in the supplied sample that repeat an earlier one exactly (share) | ≤ 0.1 | ≤ 0.25 | > 0.25 | yes |
| `gpu_utilization_at_peak` | `capacity` | Highest GPU utilization seen during the load (share) | ≥ 0.6 | ≥ 0.3 | < 0.3 | no (preview) |

#### Grade bands

| Grade | Points at least |
| --- | --- |
| A | 90 |
| B | 80 |
| C | 70 |
| D | 60 |
| F | 0 |

#### Mandatory-minimum caps

| Cap | Grade at best | Applies when |
| --- | --- | --- |
| `no_successful_request` | F | no request streamed a reply |
| `error_rate_over_25_percent` | F | more than 25% of requests failed |
| `error_rate_over_5_percent` | D | more than 5% of requests failed |
| `ttft_at_concurrency_1_failed` | C | time to first token fails its threshold even with one request at a time |
| `ttft_collapses_under_load` | C | time to first token collapses under load |
<!-- END GENERATED -->
