---
title: Frequently asked questions
source:
  repo: tokvera
  path: docs/faq.md
  ref: main
  commit: dc41c9702c312d245b5d43c089d99ba8a15d7149
prelaunch: true
order: 17
---

## Is it safe to point a scan at production?

A scan sends real load, bounded in advance:
- **The plan comes first.** It shows the requests, the concurrency levels,
  the token budget and the worst-case cost, and nothing is sent until you
  confirm (or pass `--yes`).
- **`--dry-run`** prints the plan and contacts nothing.
- **Every request is small:** one fixed, harmless prompt, at most 256
  completion tokens.
- **The caps are hard:** `--max-requests`, `--max-cost`, `--rate` and the
  suite's token budget stop the run; they are not targets.

Start with `--suite quick` (24 requests, concurrency up to 4). The default
suite goes to concurrency 16, which a small production deployment may feel.

## How much does a scan cost on a paid API?

The plan prints the worst case before anything is sent, priced from the rate
sheet. `--max-cost USD` turns that into a hard cap, and is refused for a model
the sheet has no rate for, because it could not be enforced.

## Why is the grade "provisional"?

The scoring rules are version 0.9.0. Their weights and thresholds are a
judgement that has not yet been checked against enough real endpoints, and a
0.x version says so. Until 1.0.0, a grade can move between versions for the same measurements, and every report names the version it used.
[scoring.md](scoring.md) lists every rule.

## Why does the cache check say "insufficient evidence"?

The benchmark's own prompts say nothing about your traffic. Pass
`--prompts FILE` with a sample of your real prompts: they are counted on this
machine for exact repeats, never sent, and the text is discarded.

## Why is there no tokens-per-second figure?

A token rate needs the server to report its token usage. Tokvera asks for it
(`stream_options.include_usage`), but some servers do not answer. Then the
report gives the output rate in chunks per second, and says so, rather than
call a chunk count a token count.

## Why does my cost figure say "not computed"?

The rate sheet has no row for that model. The embedded sheet covers the
OpenAI and Anthropic hosted APIs only. For anything else, write your own sheet
in the same format (the provider key for a self-hosted endpoint is
`self_hosted`) and pass `--pricing FILE`.

## Why does the p99 differ from my Grafana dashboard?

Tokvera's percentiles are exact nearest-rank over the measured samples.
Prometheus's `histogram_quantile` interpolates inside histogram buckets.
Both are called p99, and on the same traffic they can differ by up to a
bucket's width.

## Does tokvera send anything about me anywhere?

No. There is no telemetry. Tokvera contacts only the target you specify, plus GitHub when you run update or doctor --check-update, and tokvera.halotrcer.com and GitHub for the plugin's first-run install. [SECURITY.md](../SECURITY.md) has the details.

## Does it work offline?

Yes, against an endpoint you can reach: a scan contacts only its target, and
`tokvera scan --demo` contacts nothing at all. The audit runs offline too,
unless you configure an embedding provider or a language model for the
report's prose.

## What is the difference between a scan and an audit?

A **scan** measures one endpoint from the outside, in a few minutes, and is
free. An **audit** reads what your production traffic actually did (traces
and usage logs), finds where money and latency go, and delivers a client
report, a prioritized plan and a fix pack. It is the paid engagement:
[audit.md](audit.md).

## Which servers does it work with?

Anything that speaks the OpenAI chat completions API with streaming (vLLM,
TGI, Ollama, llama.cpp's server and others) and the OpenAI and Anthropic
hosted APIs. [scan.md](scan.md) has the details.

## Something is not working

Run `tokvera doctor`, then see [troubleshooting.md](troubleshooting.md).
