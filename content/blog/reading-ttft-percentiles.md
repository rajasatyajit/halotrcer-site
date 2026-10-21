---
title: Reading TTFT p95 and p99 without fooling yourself
description: An outline of a post on time to first token percentiles, what they hide, and how Tokvera measures them one request at a time and under load.
draft: true
---

## The question

Teams quote one latency number for an LLM endpoint. Users feel the slow tail, and the tail moves when traffic rises. This post will explain how to read time-to-first-token percentiles so the number you report is the one your users feel.

## Planned sections

- **What time to first token measures**, and why it is a different number from total response time for a streamed reply.
- **Why percentiles and not averages:** what p95 and p99 say about the slowest requests, and how few samples make a percentile meaningless.
- **One request at a time versus under load:** why both are needed, and what the load ratio (p99 under the highest load over p99 alone) tells you that either number hides.
- **Gaps between streamed chunks:** the latency users notice after the first token.
- **Common ways to fool yourself:** warm caches, a prompt sample that is too uniform, measuring from the wrong side of a proxy, and comparing runs taken at different concurrency.
- **How to report it:** what to put in a dashboard and in a review.

## Sources to draw on

- [How Tokvera grades an endpoint](https://tokvera.halotrcer.com/scoring), including the definitions of each latency check.
- [Tokvera report anatomy](https://tokvera.halotrcer.com/docs/report-anatomy): what each field in a report means.

## Not in this post

No benchmark results and no comparison between providers. Any figure in the finished post will come from a run whose report is linked next to it.
