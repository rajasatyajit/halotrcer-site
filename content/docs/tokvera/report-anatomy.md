---
title: What a report contains
source:
  repo: tokvera
  path: docs/report-anatomy.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 2
---

Tokvera writes two kinds of report: a **scan report** (`tokvera scan`, free)
and an **audit bundle** (`tokvera audit`, the paid engagement). Both come in a
form for people and a form for programs, and the two always carry the same
numbers.

## The scan report

`tokvera scan` writes `report.html` and `report.json` to `--out`.

### report.html

One self-contained page: inline CSS and SVG, no external request, under
300 KB. It prints cleanly and can be emailed as is. Its sections:

| Section | What it shows |
|---|---|
| The grade | A–F with its points, the scoring version (labelled provisional while it is 0.x), and any cap that bound it |
| Findings, ranked by impact | each failed or warned check: what was measured, why it matters, a suggested fix and its effort |
| Latency by concurrency | time to first token, request duration and output rate at each level, p50/p95/p99 |
| Checks | every check with its measured value, thresholds and status, including those not counted and why |
| Score | the pillars, their weights as applied, and the caps |
| Cost | the estimated cost per 1,000 requests, with the rate sheet's as-of date and source |
| What the server says about itself | the model list, server family, version and context length, as the server reported them |
| What was sent | the plan: suite, levels, caps, token budget, and the worst case it allowed |

The "Want this fixed?" footer is omitted with `--no-cta`. A scan of the
built-in simulator says SIMULATED at the top.

### report.json

The same content as data, `schema_version: tokvera.scan-report/v1.x`. The
schema only ever gains fields, so a reader written today keeps working.

| Field | Holds |
|---|---|
| `schema_version`, `tool`, `generated_at` | which format, which tokvera, when |
| `target`, `model`, `simulated`, `simulated_timing` | what was scanned, and whether it was the demo simulator |
| `score`, `scoring_version` | `grade`, `points`, `pillars[]` (`weight`, `effective_weight` as applied, `points`, `graded_checks`), `caps_applied`, `uncapped_grade`, `not_counted` (checks left out of the grade, with the reason), `provisional`, and while it is true `provisional_label` and `provisional_note` (the words the HTML and terminal show) |
| `findings[]` | ranked findings: `rank`, `check_id`, `status`, `title`, `evidence`, `impact`, `why_it_matters`, `suggested_fix`, `effort` |
| `checks[]` | every check: `id`, `pillar`, `title`, `value` and `unit`, `pass_bound` and `warn_bound`, `status`, `evidence` |
| `levels[]` | per concurrency level: requests, ok/failed/timeouts, `ttft_ms`, `request_duration_ms`, `inter_chunk_latency_ms`, output rates (`output_tokens_per_s` only where the server reported usage; `output_chunks_per_s` always), `usage_reported_requests` |
| `run` | requests sent and succeeded, duration, whether it was cancelled or stopped by the token budget |
| `plan` | the suite, levels, caps and token budget that bound the run, and its worst-case cost |
| `cost`, `pricing` | cost per 1,000 requests (an `estimate`, or why it is absent), the sheet's `as_of`, `source`, age and `stale` |
| `discovery`, `metrics`, `gpu`, `cache` | what the server reported, what `/metrics` exposed, GPU readings (preview), repeat prompts in `--prompts` |
| `privacy`, `cta` | the privacy statement, and the footer (absent with `--no-cta`) |

Two rules worth knowing:
- **Percentiles:** they are exact nearest-rank over the samples, never
  interpolated.
- **Units:** an inter-chunk gap is a chunk gap, not a per-token interval (a
  server may put several tokens in one chunk). A token rate exists only when
  the server reported its token usage.

`tokvera scan summary --report report.json` prints any report in Markdown, text
or JSON. With `--baseline` it compares two reports.

## The audit bundle

`tokvera audit` writes a directory, `<output.dir>/<audit_id>/`:

```
report.md  report.html        the client report
findings.json                 the findings, against a published schema (schema/findings.v1.schema.json)
fixpack/<playbook-id>/…       the fix pack: one directory per artifact, per matched playbook
fixpack/shared/…              the dashboard, alert rules, collector and scrape config, once
review-notes.md               for the consultant: how the narrative was produced, number words to check, open questions
DELIVERY-CHECKLIST.md         what to confirm before the client sees it, generated from what happened in the run
run-manifest.json             inputs and their SHA-256, config digest, pricing date, models and hosts used
bench-results.json            when a live benchmark ran
```

### The client report (report.md / report.html)

| Section | What it holds |
|---|---|
| 1. Executive summary | what the data shows and the first two actions of the plan |
| 2. Scorecard | every finding with its severity, confidence (High/Medium/Low) and impact |
| 3. Findings detail | each finding's measurements, evidence, what it means and why it matters |
| 4. Prioritized plan | numbered steps per playbook, in priority order, with the expected outcome |
| 5. Fix pack index | every artifact shipped, and which finding it answers |
| 6. Methodology and coverage | the window, the records analyzed and excluded, sampling, the percentile rule, which checks ran or were skipped and why |
| 7. Caveats | what the numbers do not claim |

- **No pipeline vocabulary:** the client report never says how its prose was
  produced or which playbooks are drafts. That goes to `review-notes.md` and
  `run-manifest.json`, and a test fails if pipeline vocabulary reaches the
  client report.
- **Every figure comes from code:** each number is computed from the data and
  traceable to `findings.json`.
- **Short windows:** a monthly figure projected from a window under a week is
  labelled a low-confidence projection.

### Turning a bundle into deliverables

- **`tokvera audit report --bundle DIR --client NAME`:** the client report as
  one branded page (docs/audit-kit.md).
- **`tokvera report sign --report DIR`:** a signature over every file in the
  bundle (docs/report-signing.md).
- **`tokvera stack up --fixpack DIR/fixpack`:** runs the bundle's own
  dashboard and alerts locally (docs/audit-kit.md).
